package main

import (
	"errors"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

var errInsufficientInventory = errors.New("insufficient inventory")

func adjustLatestPurchaseBatch(app core.App, ownerID, greenBeanID string, delta float64) error {
	if delta == 0 {
		return nil
	}

	records, err := app.FindRecordsByFilter(
		"green_bean_purchase_batches",
		"green_bean_id = {:greenBeanID} && owner = {:ownerID}",
		"-received_at,-created_at",
		1,
		0,
		dbx.Params{"greenBeanID": greenBeanID, "ownerID": ownerID},
	)
	if err != nil {
		return err
	}
	if len(records) == 0 {
		return errors.New("未找到可用的生豆采购批次")
	}

	purchaseBatch := records[0]
	purchasedWeight, _ := nonNegativeNumber(purchaseBatch.GetRaw("purchased_weight_grams"))
	remainingWeight, validRemainingWeight := nonNegativeNumber(purchaseBatch.GetRaw("remaining_weight_grams"))
	if !validRemainingWeight {
		remainingWeight = purchasedWeight
	}

	nextRemainingWeight := remainingWeight - delta
	if nextRemainingWeight < 0 {
		return errInsufficientInventory
	}
	if nextRemainingWeight > purchasedWeight {
		nextRemainingWeight = purchasedWeight
	}

	purchaseBatch.Set("remaining_weight_grams", nextRemainingWeight)
	return app.Save(purchaseBatch)
}
