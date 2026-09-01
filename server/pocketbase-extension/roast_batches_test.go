package main

import "testing"

func TestRoastBatchPayloadSupportsAgtronFields(t *testing.T) {
	payload := map[string]any{
		"bean_agtron_color":  82.5,
		"ground_agtron_color": 76.0,
		"roast_level_source":  "beanAgtron",
	}

	if err := validateRoastBatchPayloadFields(payload); err != nil {
		t.Fatalf("Agtron payload was rejected: %v", err)
	}
}

func TestRoastBatchPayloadRejectsUnknownFields(t *testing.T) {
	if err := validateRoastBatchPayloadFields(map[string]any{"unexpected": true}); err == nil {
		t.Fatal("unknown payload field was accepted")
	}
}
