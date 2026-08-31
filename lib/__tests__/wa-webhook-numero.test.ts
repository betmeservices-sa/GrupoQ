// A qué número llegó un aviso de WhatsApp.

import { describe, expect, it } from "vitest";
import { phoneNumberIdDe } from "@/lib/wa-webhook-numero";

describe("el número destino de un aviso", () => {
  it("lo saca de metadata.phone_number_id", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "50370200301", phone_number_id: "987" },
                messages: [],
              },
            },
          ],
        },
      ],
    };
    expect(phoneNumberIdDe(payload)).toBe("987");
  });

  it("sin metadata no inventa nada", () => {
    expect(phoneNumberIdDe({ entry: [{ changes: [{ value: {} }] }] })).toBeNull();
    expect(phoneNumberIdDe({})).toBeNull();
    expect(phoneNumberIdDe(null)).toBeNull();
  });
});
