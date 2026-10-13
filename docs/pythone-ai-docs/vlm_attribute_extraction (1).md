# REDRESS — Estrazione attributi catalogo via VLM locale

Pipeline batch: per ogni prodotto → immagine flat-lay (+ foto indossata se c'è) + titolo/descrizione del fornitore → VLM → JSON validato → `products`.

Modello consigliato: Qwen3-VL 8B o 32B (Apache 2.0) via vLLM, con **output JSON vincolato** (guided decoding con lo schema qui sotto). Temperature 0. Senza il vincolo il modello inventa colori fuori vocabolario e rompe il DB.

---

## System prompt

```
You are a fashion catalog annotator for an Italian e-commerce. You receive one or two
images of a garment (flat-lay and/or worn on a model) plus the supplier's title and
description. Your job is to fill a structured record. You are NOT a stylist here: describe
what the garment IS, never how to wear it.

RULES
1. Output ONLY a JSON object matching the schema. No prose, no markdown fences.
2. Use ONLY values from the closed vocabularies below. If nothing fits, use the value
   "other" and explain in `notes`. Never invent new labels.
3. Trust the image over the supplier text for color, pattern and construction.
   Trust the supplier text over the image for fabric composition. If they conflict, note it.
4. If you cannot determine a field from the evidence, set it to null and lower `confidence`.
   Guessing is worse than null: a null gets human review, a guess corrupts the catalog.
5. Formality is about the garment alone, on a 1-5 scale:
   1 = beach/gym, 2 = casual weekend, 3 = smart casual / office relaxed,
   4 = business / evening, 5 = formal / black tie.
6. fit_intent describes the brand's DESIGN intent (visible in silhouette, drop shoulders,
   ease), not how it might fit a specific person.
7. layer: 0 = worn against skin (t-shirt, shirt, dress, trousers), 1 = mid layer
   (knitwear, blazer, gilet), 2 = outer layer (coat, parka, heavy jacket). Shoes/bags: null.
8. occasions: pick ALL that plausibly apply from the list, typically 2-4.

VOCABULARIES
category: top, shirt, knitwear, jacket, coat, dress, jumpsuit, trousers, jeans, skirt,
          shorts, shoes, bag, accessory
vton_slot: tops, bottoms, one-pieces, none   (jacket/coat/knitwear/shirt/top -> tops;
          trousers/jeans/skirt/shorts -> bottoms; dress/jumpsuit -> one-pieces; else none)
gender_cut: W, M, U
fit_intent: slim, regular, relaxed, oversized
season: SS, AW, all
color_primary: black, white, off_white, grey, charcoal, navy, blue, light_blue, denim,
          beige, camel, brown, chocolate, olive, green, sage, burgundy, red, coral, pink,
          blush, lilac, purple, yellow, mustard, orange, gold, silver, multicolor, other
color_family: neutral, warm, cool, bright
pattern: solid, stripe, check, houndstooth, floral, animal, geometric, print, logo, other
occasions: office, interview, business_formal, wedding_guest, ceremony, cocktail,
          aperitivo, dinner_out, date, weekend, travel, sport, beach, home, evening_out
sleeve (attrs_extra): sleeveless, short, three_quarter, long, null
neckline (attrs_extra): crew, v_neck, turtleneck, collar, button_down, mandarin, boat,
          square, off_shoulder, hooded, lapel, null
waist_rise (attrs_extra, bottoms only): low, mid, high, null
closure (attrs_extra): buttons, zip, pullover, wrap, belt, none, null
```

## User message (template per prodotto)

```
Supplier title: {title}
Supplier description: {description}
Supplier composition: {composition_raw or "not provided"}
Images attached: {n} ({"flat-lay" / "on model"})
```

## JSON schema (guided decoding)

```json
{
  "type": "object",
  "required": ["category","vton_slot","gender_cut","fit_intent","season","formality",
               "color_primary","color_family","pattern","fabric","stretch_pct","layer",
               "occasions","attrs_extra","confidence","notes"],
  "properties": {
    "category":      {"enum": ["top","shirt","knitwear","jacket","coat","dress","jumpsuit","trousers","jeans","skirt","shorts","shoes","bag","accessory"]},
    "vton_slot":     {"enum": ["tops","bottoms","one-pieces","none"]},
    "gender_cut":    {"enum": ["W","M","U"]},
    "fit_intent":    {"enum": ["slim","regular","relaxed","oversized"]},
    "season":        {"enum": ["SS","AW","all"]},
    "formality":     {"type": "integer", "minimum": 1, "maximum": 5},
    "color_primary": {"type": "string"},
    "color_secondary": {"type": ["string","null"]},
    "color_family":  {"enum": ["neutral","warm","cool","bright"]},
    "pattern":       {"type": "string"},
    "fabric": {
      "type": "object",
      "properties": {
        "composition": {"type": ["object","null"], "additionalProperties": {"type": "number"}},
        "weight_class": {"enum": ["light","medium","heavy", null]},
        "texture": {"type": ["string","null"]}
      }
    },
    "stretch_pct":   {"type": ["number","null"]},
    "layer":         {"type": ["integer","null"], "minimum": 0, "maximum": 2},
    "occasions":     {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 5},
    "attrs_extra": {
      "type": "object",
      "properties": {
        "sleeve":     {"type": ["string","null"]},
        "neckline":   {"type": ["string","null"]},
        "waist_rise": {"type": ["string","null"]},
        "closure":    {"type": ["string","null"]},
        "length_desc": {"type": ["string","null"]}
      }
    },
    "confidence":    {"type": "number", "minimum": 0, "maximum": 1},
    "notes":         {"type": ["string","null"]}
  }
}
```

## Regola per stretch_pct (il VLM non la vede: si deriva)

Dalla composizione, in post-processing, non dal modello:

| elastan / lycra | stretch_pct |
|---|---|
| 0 %, tessuto piano (popeline, denim rigido, lana pettinata) | 0 |
| 0 %, ma maglia/jersey (t-shirt, knitwear) | 8-15 (per struttura) |
| 1-2 % | 5 |
| 3-5 % | 10 |
| > 5 % o "stretch" nel titolo | 15-20 |

Se `composition` è null → `stretch_pct` null → `specs_source` in `product_sizes` resta `estimated` e il fit engine applica la penalità.

## Validazione post-estrazione (obbligatoria)

1. **Vocabolario**: ogni enum viene verificato in codice; "other" → coda revisione umana.
2. **Coerenza**: `category` ↔ `vton_slot` ↔ `layer` (es. coat con layer 0 → errore).
3. **Confidence < 0.75** → revisione umana. Aspettatevi 15-25 % del catalogo all'inizio.
4. **Campionamento**: 5 % random dei record ad alta confidence riverificati a mano ogni settimana. È il vostro benchmark di qualità del VLM; se scende sotto il 90 % di accordo, si rivede il prompt.
5. `attrs_source = 'vlm'` sempre; passa a `'human'` solo dopo revisione.

## Esempi few-shot (metterne 3-5 nel prompt, con immagine)

**Esempio 1 — camicia**
Input: "Camicia Oxford button-down, 100% cotone"
```json
{"category":"shirt","vton_slot":"tops","gender_cut":"M","fit_intent":"regular","season":"all",
 "formality":3,"color_primary":"light_blue","color_secondary":null,"color_family":"cool",
 "pattern":"solid","fabric":{"composition":{"cotton":1.0},"weight_class":"medium","texture":"oxford"},
 "stretch_pct":0,"layer":0,"occasions":["office","weekend","aperitivo","interview"],
 "attrs_extra":{"sleeve":"long","neckline":"button_down","waist_rise":null,"closure":"buttons","length_desc":"hip"},
 "confidence":0.95,"notes":null}
```

**Esempio 2 — abito da cerimonia**
Input: "Abito midi in raso, cinturino in vita"
```json
{"category":"dress","vton_slot":"one-pieces","gender_cut":"W","fit_intent":"slim","season":"all",
 "formality":4,"color_primary":"burgundy","color_secondary":null,"color_family":"warm",
 "pattern":"solid","fabric":{"composition":null,"weight_class":"light","texture":"satin"},
 "stretch_pct":null,"layer":0,"occasions":["wedding_guest","ceremony","cocktail","dinner_out"],
 "attrs_extra":{"sleeve":"sleeveless","neckline":"v_neck","waist_rise":null,"closure":"zip","length_desc":"midi"},
 "confidence":0.8,"notes":"Composition not provided by supplier; satin look inferred from image."}
```

## Costi indicativi

Qwen3-VL 8B su una RTX 4090: ~2-4 s a prodotto con 2 immagini → 10k SKU in poche ore. Il 32B è più preciso su formality e fit_intent ma 3-4× più lento; conviene usarlo solo per il campione di validazione o per i record con confidence bassa.
