package main

import (
	"net/http"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

const defaultAiUsageLimit = 10
const defaultRoastAiUsageLimit = 20

func getDefaultAiUsageLimit(feature string) int {
	if feature == "roast_analysis" || feature == "roast_general_question" || feature == "roast_plan_recommendation" {
		return defaultRoastAiUsageLimit
	}

	return defaultAiUsageLimit
}

type aiUsageReservationInput struct {
	Feature string `json:"feature"`
	Month   string `json:"month"`
	OwnerID string `json:"ownerId"`
}

func registerAiUsageRoutes(se *core.ServeEvent) {
	se.Router.POST("/api/easybake/ai-usage/reserve", reserveAiUsage).
		Bind(apis.RequireSuperuserAuth())
}

func reserveAiUsage(e *core.RequestEvent) error {
	input := aiUsageReservationInput{}
	if err := e.BindBody(&input); err != nil {
		return e.BadRequestError("AI 额度预占请求无效。", err)
	}
	if input.OwnerID == "" || input.Feature == "" || input.Month == "" {
		return e.BadRequestError("AI 额度预占缺少必要参数。", nil)
	}

	result := map[string]any{}
	err := e.App.RunInTransaction(func(txApp core.App) error {
		limit := getDefaultAiUsageLimit(input.Feature)
		enabled := true
		limitRecord, err := txApp.FindFirstRecordByFilter(
			"ai_usage_limits",
			"owner = {:owner} && feature = {:feature}",
			dbx.Params{"owner": input.OwnerID, "feature": input.Feature},
		)
		if err == nil {
			enabled = limitRecord.GetBool("enabled")
			if value := limitRecord.GetInt("monthly_limit"); value >= 0 {
				limit = value
			}
		}
		if !enabled {
			return e.ForbiddenError("当前账号的 AI 功能已关闭。", nil)
		}

		usedRecords, err := txApp.FindRecordsByFilter(
			"ai_usage_logs",
			"owner = {:owner} && feature = {:feature} && month = {:month} && status = 'success'",
			"",
			0,
			0,
			dbx.Params{"owner": input.OwnerID, "feature": input.Feature, "month": input.Month},
		)
		if err != nil {
			return err
		}
		if len(usedRecords) >= limit {
			return e.TooManyRequestsError("本月 AI 使用次数已用完。", nil)
		}

		collection, err := txApp.FindCollectionByNameOrId("ai_usage_logs")
		if err != nil {
			return err
		}
		record := core.NewRecord(collection)
		now := time.Now().UTC().Format(time.RFC3339)
		record.Set("owner", input.OwnerID)
		record.Set("feature", input.Feature)
		record.Set("month", input.Month)
		record.Set("status", "success")
		record.SetIfFieldExists("created_at", now)
		record.SetIfFieldExists("updated_at", now)
		if err := txApp.Save(record); err != nil {
			return err
		}

		result = map[string]any{
			"logId": record.Id,
			"monthlyLimit": limit,
			"remainingUses": limit - len(usedRecords) - 1,
			"usedThisMonth": len(usedRecords) + 1,
		}
		return nil
	})
	if err != nil {
		return err
	}

	return e.JSON(http.StatusCreated, result)
}
