package main

import (
	"errors"
	"log"
	"net/http"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

var errInventoryVersionConflict = errors.New("inventory version conflict")

// These values are injected by the deployment script with Go ldflags.
var (
	buildVersion = "dev"
	buildCommit  = "unknown"
	buildAt      = "unknown"
)

func main() {
	app := pocketbase.New()

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/easybake/health", func(e *core.RequestEvent) error {
			return e.JSON(http.StatusOK, map[string]string{
				"buildAt":  buildAt,
				"commit":   buildCommit,
				"status":   "ok",
				"version":  buildVersion,
			})
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
