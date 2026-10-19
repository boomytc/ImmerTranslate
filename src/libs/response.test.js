import { parseResponse } from "./response";

describe("parseResponse", () => {
  test("parses JSON responses by default", async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    await expect(parseResponse(response)).resolves.toEqual({ ok: true });
  });

  test("returns text when JSON parsing fails", async () => {
    const response = new Response("plain text", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });

    await expect(parseResponse(response)).resolves.toBe("plain text");
  });

  test("keeps explicit text expectation", async () => {
    const response = new Response("data: hello\n\n", {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });

    await expect(parseResponse(response, "text")).resolves.toBe(
      "data: hello\n\n"
    );
  });

  test("throws a clear error when non-stream path receives SSE", async () => {
    const response = new Response("data: hello\n\n", {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });

    await expect(parseResponse(response)).rejects.toThrow(
      "Received text/event-stream"
    );
  });

  test("extracts HTTP error body and keeps the status on the error", async () => {
    const response = new Response(JSON.stringify({ error: "bad" }), {
      status: 400,
      statusText: "Bad Request",
      headers: { "Content-Type": "application/json" },
    });

    await expect(parseResponse(response)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('"status":400'),
    });
    await expect(parseResponse(response.clone())).rejects.toThrow(
      '"error":"bad"'
    );
  });

  test("keeps a plain-text error body and its HTTP status", async () => {
    const response = new Response("invalid api key", {
      status: 401,
      statusText: "Unauthorized",
      headers: { "Content-Type": "text/plain" },
    });

    await expect(parseResponse(response)).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("invalid api key"),
    });
  });
});
