import { NextResponse } from "next/server";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId?: string;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  requestId?: string;
};

export function apiOk<T>(data: T, requestId?: string, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>(
    { ok: true, data, requestId },
    init,
  );
}

export function apiFail(
  code: string,
  message: string,
  status = 400,
  requestId?: string,
) {
  return NextResponse.json<ApiFailure>(
    { ok: false, error: { code, message }, requestId },
    { status },
  );
}
