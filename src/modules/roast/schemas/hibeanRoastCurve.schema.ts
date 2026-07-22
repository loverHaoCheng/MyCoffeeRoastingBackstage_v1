import { z } from 'zod';

const valueWithUnitSchema = z.object({
  unit: z.string().nullable().optional(),
  value: z.number().nullable().optional(),
});

const hibeanRoasterParamSchema = z.object({
  key: z.string(),
  value: z.number(),
});

export const hibeanRoastCurvePointSchema = z.object({
  bt: z.number().optional(),
  duration: z.number(),
  et: z.number().optional(),
  event: z.number().optional(),
  roasterParams: z.array(hibeanRoasterParamSchema).optional(),
  ror: z.number().optional(),
});

export const hibeanRoastCurveEventSchema = z.object({
  event: z.number(),
  temperature: z.number().optional(),
  temperatureUnit: z.string().optional(),
  time: z.number(),
});

export const hibeanRoastCurvePhaseSchema = z.object({
  duration: z.number(),
  percentage: z.number(),
  phase: z.number(),
});

export const hibeanRoastCurveSchema = z.object({
  dataList: z.array(hibeanRoastCurvePointSchema).min(1),
  dateTime: z.string().optional(),
  deviceInfo: z
    .object({
      manufacturer: z.string().optional(),
      model: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  duration: z.number().optional(),
  eventList: z.array(hibeanRoastCurveEventSchema).optional(),
  name: z.string().optional(),
  phaseList: z.array(hibeanRoastCurvePhaseSchema).optional(),
  roastContext: z
    .object({
      bean: z
        .object({
          name: z.string().nullable().optional(),
          origin: z.string().nullable().optional(),
          processingMethod: z.number().nullable().optional(),
          regionCode: z.string().nullable().optional(),
        })
        .optional(),
      greenBeanWeight: valueWithUnitSchema.optional(),
    })
    .optional(),
  sampleInterval: z.number().positive().optional(),
  temperatureUnit: z.string().optional(),
  version: z.string().optional(),
});

export type HiBeanRoastCurve = z.infer<typeof hibeanRoastCurveSchema>;
export type HiBeanRoastCurveEvent = z.infer<typeof hibeanRoastCurveEventSchema>;
export type HiBeanRoastCurvePhase = z.infer<typeof hibeanRoastCurvePhaseSchema>;
