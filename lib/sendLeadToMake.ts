type LeadPayload = {
  name: string;
  phone: string;
  specialty: string;
};

export async function sendLeadToMake({ name, phone, specialty }: LeadPayload) {
  try {
    await fetch("https://hook.eu2.make.com/civdi1w15tu7v4ccacd454xyig1xg62m", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        specialty,
        source: "Website AI Chat",
      }),
    });
    console.log("✅ Lead pushed to Make:", { name, phone, specialty });
  } catch (error) {
    console.error("❌ Make webhook failed:", error);
  }
}
