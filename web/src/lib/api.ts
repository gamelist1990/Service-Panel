interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  uuid: string;
}

export async function api<T>(path: string, options: ApiOptions): Promise<T> {
  const { method = "GET", body, uuid } = options;
  const queryPrefix = path.includes("?") ? "&" : "?";
  const response = await fetch(`${path}${queryPrefix}uuid=${encodeURIComponent(uuid)}`, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = raw || `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed.error) {
        message = parsed.error;
      }
    } catch {
      // keep raw message
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null as T;
  }
  return (await response.json()) as T;
}

