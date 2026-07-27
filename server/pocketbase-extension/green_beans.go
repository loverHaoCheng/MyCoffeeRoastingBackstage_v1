package main

import (
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// registerGreenBeanRoutes 注册生豆级联删除端点。
//
// 背景：原先由前端串行发起 6+ 个删除请求完成级联删除，任一中途失败
// 都会留下半删状态（僵尸生豆、库存与财务不一致）。此端点在单个数据库
// 事务中完成全部级联删除，要么全部成功、要么全部回滚。
func registerGreenBeanRoutes(se *core.ServeEvent) {
	se.Router.DELETE("/api/easybake/green-beans/{id}", deleteGreenBeanCascade).
		Bind(apis.RequireAuth("users"))
}

func deleteOwnedRecordsByFilter(txApp core.App, collection, filter string, params dbx.Params) error {
	records, err := txApp.FindRecordsByFilter(collection, filter, "", 0, 0, params)
	if err != nil {
		return err
	}
	for _, record := range records {
		if err := txApp.Delete(record); err != nil {
			return err
		}
	}
	return nil
}

func deleteGreenBeanCascade(e *core.RequestEvent) error {
	beanID := e.Request.PathValue("id")
	roastPlanDisposition := e.Request.URL.Query().Get("roastPlanDisposition")

	err := e.App.RunInTransaction(func(txApp core.App) error {
		bean, err := txApp.FindRecordById("green_beans", beanID)
		if err != nil {
			return e.NotFoundError("未找到生豆记录。", err)
		}
		if stringValue(bean.GetRaw("owner")) != e.Auth.Id {
			return e.ForbiddenError("无权删除该生豆。", nil)
		}

		ownerParams := dbx.Params{"beanID": beanID, "ownerID": e.Auth.Id}
		byBeanFilter := "green_bean_id = {:beanID} && owner = {:ownerID}"

		batches, err := txApp.FindRecordsByFilter(
			"roast_batches",
			byBeanFilter,
			"",
			0,
			0,
			ownerParams,
		)
		if err != nil {
			return err
		}
		for _, batch := range batches {
			if err := deleteOwnedRecordsByFilter(
				txApp,
				"roast_curve_records",
				"roast_batch_id = {:batchID} && owner = {:ownerID}",
				dbx.Params{"batchID": batch.Id, "ownerID": e.Auth.Id},
			); err != nil {
				return err
			}
			if err := txApp.Delete(batch); err != nil {
				return err
			}
		}

		if err := deleteOwnedRecordsByFilter(txApp, "green_bean_purchase_batches", byBeanFilter, ownerParams); err != nil {
			return err
		}
		if err := deleteOwnedRecordsByFilter(txApp, "roast_records", byBeanFilter, ownerParams); err != nil {
			return err
		}

		if roastPlanDisposition == "makeGeneric" {
			profiles, err := txApp.FindRecordsByFilter("roast_profiles", byBeanFilter, "", 0, 0, ownerParams)
			if err != nil {
				return err
			}
			for _, profile := range profiles {
				profile.Set("green_bean_id", "")
				if err := txApp.Save(profile); err != nil {
					return err
				}
			}
		} else if err := deleteOwnedRecordsByFilter(txApp, "roast_profiles", byBeanFilter, ownerParams); err != nil {
			return err
		}

		if err := deleteOwnedRecordsByFilter(txApp, "bean_sale_specs", byBeanFilter, ownerParams); err != nil {
			return err
		}

		return txApp.Delete(bean)
	})
	if err != nil {
		return err
	}

	return e.JSON(http.StatusOK, map[string]string{"id": beanID})
}
