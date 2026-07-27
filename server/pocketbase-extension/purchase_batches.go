package main

import (
	"errors"
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

var purchaseBatchFields = []string{
	"purchased_total_price",
	"purchased_weight_grams",
	"remaining_weight_grams",
	"supplier_name",
	"received_at",
}

func registerPurchaseBatchRoutes(se *core.ServeEvent) {
	se.Router.PATCH("/api/easybake/purchase-batches/{id}", updatePurchaseBatch).
		Bind(apis.RequireAuth("users"))
}

func updatePurchaseBatch(e *core.RequestEvent) error {
	payload, err := bindPayload(e)
	if err != nil {
		return err
	}

	expectedUpdatedAt := stringValue(payload["__expected_updated_at"])
	if expectedUpdatedAt == "" {
		return e.BadRequestError("库存更新必须携带版本信息，请刷新后重试。", nil)
	}
	delete(payload, "__expected_updated_at")

	var updated *core.Record
	err = e.App.RunInTransaction(func(txApp core.App) error {
		record, err := txApp.FindRecordById("green_bean_purchase_batches", e.Request.PathValue("id"))
		if err != nil {
			return e.NotFoundError("未找到生豆采购批次。", err)
		}
		if stringValue(record.GetRaw("owner")) != e.Auth.Id {
			return e.ForbiddenError("无权修改该生豆采购批次。", nil)
		}
		if !matchesPurchaseBatchVersion(record.GetString("updated_at"), expectedUpdatedAt) {
			return errInventoryVersionConflict
		}

		for _, field := range purchaseBatchFields {
			if value, exists := payload[field]; exists {
				record.SetIfFieldExists(field, value)
			}
		}
		if err := txApp.Save(record); err != nil {
			return err
		}
		updated = record
		return nil
	})
	if errors.Is(err, errInventoryVersionConflict) {
		return e.JSON(http.StatusConflict, map[string]string{
			"message": "库存已被其他操作更新，请刷新后重试。",
		})
	}
	if err != nil {
		return err
	}
	return e.JSON(http.StatusOK, updated)
}

// PocketBase serializes datetime values with "T", while SQLite stores the same value with a space.
func matchesPurchaseBatchVersion(currentUpdatedAt, expectedUpdatedAt string) bool {
	normalize := func(value string) string {
		return strings.Replace(strings.TrimSpace(value), "T", " ", 1)
	}

	return normalize(currentUpdatedAt) == normalize(expectedUpdatedAt)
}
