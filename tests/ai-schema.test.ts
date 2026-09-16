import { describe, expect, it } from "vitest";
import { extractJson, toJsonSchema } from "@/lib/ai/index";
import { ClassificationSchema } from "@/lib/types";

describe("toJsonSchema (what we send to Gemini as responseJsonSchema)", () => {
  const js = toJsonSchema(ClassificationSchema) as {
    $schema?: string;
    type: string;
    properties: Record<string, Record<string, unknown>>;
    required?: string[];
  };

  it("is a plain object schema without the $schema key", () => {
    expect(js.$schema).toBeUndefined();
    expect(js.type).toBe("object");
    expect(js.required).toContain("intent");
    expect(js.required).toContain("fit_score");
  });

  it("keeps enums, integer bounds and nullable fields in supported form", () => {
    expect(js.properties.intent.enum).toEqual([
      "medicine_food_question",
      "app_recommendation",
      "nutrition_question",
      "competitor_complaint",
      "irrelevant",
    ]);
    expect(js.properties.fit_score.type).toBe("integer");
    expect(js.properties.fit_score.minimum).toBe(0);
    expect(js.properties.fit_score.maximum).toBe(100);
    // nullable string → anyOf [string, null]; Gemini's responseJsonSchema supports anyOf
    expect(JSON.stringify(js.properties.competitor)).toContain("null");
  });
});

describe("extractJson", () => {
  it("returns bare JSON untouched", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });
  it("unwraps a code fence", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("finds the object inside prose", () => {
    expect(extractJson('Sure! Here it is: {"a":1} hope that helps')).toBe('{"a":1}');
  });
});

describe("ClassificationSchema", () => {
  it("accepts a well-formed answer and rejects an out-of-range score", () => {
    const good = ClassificationSchema.safeParse({
      intent: "medicine_food_question",
      conditions: ["type 2 diabetes"],
      medicines: ["metformin"],
      competitor: null,
      fit_score: 92,
      urgency: "medium",
      language: "en",
      do_not_reply: false,
      do_not_reply_reason: null,
      summary: "Asks whether rice and roti are fine on metformin.",
    });
    expect(good.success).toBe(true);
    const bad = ClassificationSchema.safeParse({ ...(good.success ? good.data : {}), fit_score: 140 });
    expect(bad.success).toBe(false);
  });
});
