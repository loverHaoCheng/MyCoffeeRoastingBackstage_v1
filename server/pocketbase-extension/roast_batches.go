package main

import (
	"errors"
	"net/http"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

var roastBatchFields = []string{
	"roast_date", "green_bean_id", "green_bean_name", "roasted_bean_name",
	"roast_plan_id", "roast_plan_name", "input_weight_grams", "output_weight_grams",
	"roast_level", "development_ratio", "first_crack_time", "total_roast_time",
	"notes", "image_urls", "status", "sales_mode", "final_sale_unit_price",
	"evaluation", "sold_unit_count", "roast_level_source", "bean_agtron_color", "ground_agtron_color", "sale_unit_price_snapshot",
	"bean_cost_per_sale_unit_snapshot", "non_bean_cost_per_sale_unit_snapshot",
}

func registerRoastBatchRoutes(se *core.ServeEvent) {
	se.Router.POST("/api/easybake/roast-batches/commit", commitRoastBatch).
		Bind(apis.RequireAuth("users"))
	se.Router.PATCH("/api/easybake/roast-batches/{id}", updateRoastBatch).
		Bind(apis.RequireAuth("users"))
	se.Router.DELETE("/api/easybake/roast-batches/{id}", deleteRoastBatch).
		Bind(apis.RequireAuth("users"))
}

func commitRoastBatch(e *core.RequestEvent) error {
	payload, err := bindPayload(e)
	if err != nil {
		return err
	}

	var created *core.Record
	err = e.App.RunInTransaction(func(txApp core.App) error {
		greenBeanID, inputWeight, status, err := validatePayload(payload)
		if err != nil {
			return e.BadRequestError(err.Error(), nil)
		}
		if err := ensureOwnedGreenBean(e, txApp, greenBeanID); err != nil {
			return err
		}

		collection, err := txApp.FindCollectionByNameOrId("roast_batches")
		if err != nil {
			return err
		}

		record := core.NewRecord(collection)
		record.Set("owner", e.Auth.Id)
		applyPayload(record, payload)

		if status == "completed" {
			if err := adjustLatestPurchaseBatch(txApp, e.Auth.Id, greenBeanID, inputWeight); err != nil {
				return err
			}
		}
		if err := txApp.Save(record); err != nil {
			return err
		}

		created = record
		return nil
	})

	return transactionResponse(e, err, http.StatusCreated, created)
}

func updateRoastBatch(e *core.RequestEvent) error {
	payload, err := bindPayload(e)
	if err != nil {
		return err
	}

	var updated *core.Record
	err = e.App.RunInTransaction(func(txApp core.App) error {
		record, err := txApp.FindRecordById("roast_batches", e.Request.PathValue("id"))
		if err != nil {
			return e.NotFoundError("未找到烘焙记录。", err)
		}
		if stringValue(record.GetRaw("owner")) != e.Auth.Id {
			return e.ForbiddenError("无权修改该烘焙记录。", nil)
		}

		oldBeanID, oldWeight, oldStatus, err := validateRecord(record)
		if err != nil {
			return err
		}

		applyPayload(record, payload)
		newBeanID, newWeight, newStatus, err := validateRecord(record)
		if err != nil {
			return e.BadRequestError(err.Error(), nil)
		}
		if err := ensureOwnedGreenBean(e, txApp, newBeanID); err != nil {
			return err
		}

		if err := adjustInventoryForChange(
			txApp,
			e.Auth.Id,
			oldBeanID,
			inventoryImpact(oldWeight, oldStatus),
			newBeanID,
			inventoryImpact(newWeight, newStatus),
		); err != nil {
			return err
		}
		if err := txApp.Save(record); err != nil {
			return err
		}

		updated = record
		return nil
	})

	return transactionResponse(e, err, http.StatusOK, updated)
}

func deleteRoastBatch(e *core.RequestEvent) error {
	err := e.App.RunInTransaction(func(txApp core.App) error {
		record, err := txApp.FindRecordById("roast_batches", e.Request.PathValue("id"))
		if err != nil {
			return e.NotFoundError("未找到烘焙记录。", err)
		}
		if stringValue(record.GetRaw("owner")) != e.Auth.Id {
			return e.ForbiddenError("无权删除该烘焙记录。", nil)
		}

		beanID, weight, status, err := validateRecord(record)
		if err != nil {
			return err
		}
		if status == "completed" {
			if err := adjustLatestPurchaseBatch(txApp, e.Auth.Id, beanID, -weight); err != nil {
				return err
			}
		}

		curves, err := txApp.FindRecordsByFilter(
			"roast_curve_records",
			"roast_batch_id = {:batchID} && owner = {:ownerID}",
			"",
			0,
			0,
			dbx.Params{"batchID": record.Id, "ownerID": e.Auth.Id},
		)
		if err != nil {
			return err
		}
		for _, curve := range curves {
			if err := txApp.Delete(curve); err != nil {
				return err
			}
		}

		return txApp.Delete(record)
	})

	if errors.Is(err, errInsufficientInventory) {
		return inventoryConflict(e)
	}
	if err != nil {
		return err
	}
	return e.JSON(http.StatusOK, map[string]string{"id": e.Request.PathValue("id")})
}

func bindPayload(e *core.RequestEvent) (map[string]any, error) {
	payload := map[string]any{}
	if err := e.BindBody(&payload); err != nil {
		return nil, e.BadRequestError("请求数据格式无效。", err)
	}
	if err := validateRoastBatchPayloadFields(payload); err != nil {
		return nil, e.BadRequestError(err.Error(), nil)
	}
	return payload, nil
}

func validateRoastBatchPayloadFields(payload map[string]any) error {
	allowed := make(map[string]struct{}, len(roastBatchFields))
	for _, field := range roastBatchFields {
		allowed[field] = struct{}{}
	}
	for field := range payload {
		if _, ok := allowed[field]; !ok {
			return errors.New("烘焙记录包含未支持的字段: " + field)
		}
	}
	return nil
}

func applyPayload(record *core.Record, payload map[string]any) {
	for _, field := range roastBatchFields {
		if value, exists := payload[field]; exists {
			record.SetIfFieldExists(field, value)
		}
	}
}

func ensureOwnedGreenBean(e *core.RequestEvent, app core.App, greenBeanID string) error {
	_, err := app.FindFirstRecordByFilter(
		"green_beans",
		"id = {:id} && owner = {:owner}",
		dbx.Params{"id": greenBeanID, "owner": e.Auth.Id},
	)
	if err != nil {
		return e.ForbiddenError("无权使用该生豆。", err)
	}
	return nil
}

func validatePayload(payload map[string]any) (string, float64, string, error) {
	greenBeanID := stringValue(payload["green_bean_id"])
	inputWeight, validWeight := positiveNumber(payload["input_weight_grams"])
	status := stringValue(payload["status"])
	if status == "" {
		status = "completed"
		payload["status"] = status
	}
	if greenBeanID == "" || !validWeight {
		return "", 0, "", errors.New("生豆和入豆重量不能为空")
	}
	if status != "completed" && status != "draft" {
		return "", 0, "", errors.New("烘焙状态无效")
	}
	return greenBeanID, inputWeight, status, nil
}

func validateRecord(record *core.Record) (string, float64, string, error) {
	return validatePayload(map[string]any{
		"green_bean_id":      record.GetRaw("green_bean_id"),
		"input_weight_grams": record.GetRaw("input_weight_grams"),
		"status":             record.GetRaw("status"),
	})
}

func adjustInventoryForChange(
	app core.App,
	ownerID, oldBeanID string,
	oldImpact float64,
	newBeanID string,
	newImpact float64,
) error {
	if oldBeanID == newBeanID {
		return adjustLatestPurchaseBatch(app, ownerID, oldBeanID, newImpact-oldImpact)
	}
	if oldImpact > 0 {
		if err := adjustLatestPurchaseBatch(app, ownerID, oldBeanID, -oldImpact); err != nil {
			return err
		}
	}
	return adjustLatestPurchaseBatch(app, ownerID, newBeanID, newImpact)
}

func inventoryImpact(weight float64, status string) float64 {
	if status == "draft" {
		return 0
	}
	return weight
}

func transactionResponse(e *core.RequestEvent, err error, status int, record *core.Record) error {
	if errors.Is(err, errInsufficientInventory) {
		return inventoryConflict(e)
	}
	if err != nil {
		return err
	}
	return e.JSON(status, record)
}

func inventoryConflict(e *core.RequestEvent) error {
	return e.JSON(http.StatusConflict, map[string]string{
		"message": "剩余库存不足，无法记录本次烘焙。",
	})
}

func stringValue(value any) string {
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(text)
}

func positiveNumber(value any) (float64, bool) {
	number, ok := value.(float64)
	return number, ok && number > 0
}

func nonNegativeNumber(value any) (float64, bool) {
	number, ok := value.(float64)
	return number, ok && number >= 0
}
