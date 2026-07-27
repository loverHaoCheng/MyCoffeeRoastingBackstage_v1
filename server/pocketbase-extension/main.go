package main

import (
	"errors"
	"log"
	"net/http"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

var errInventoryVersionConflict = errors.New("inventory version conflict")

func main() {
	app := pocketbase.New()

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/easybake/health", func(e *core.RequestEvent) error {
			return e.JSON(http.StatusOK, map[string]string{"status": "ok"})
		})
		registerRoastBatchRoutes(se)
		registerPurchaseBatchRoutes(se)
		registerGreenBeanRoutes(se)
		registerAiUsageRoutes(se)

		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
