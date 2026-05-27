export function getAccessUuid(): string {
  const injected = (window as Window & { __ACCESS_UUID__?: string }).__ACCESS_UUID__;
  if (injected) {
    return injected;
  }
  const params = new URLSearchParams(window.location.search);
  return params.get("uuid") ?? "";
}

