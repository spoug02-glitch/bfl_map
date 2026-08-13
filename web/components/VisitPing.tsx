"use client";

import { useEffect } from "react";
import {
  LAST_PING_STORAGE_KEY,
  VISITOR_ID_STORAGE_KEY,
  isValidVisitorId,
  shouldPing,
} from "@/lib/analytics";

/**
 * Records one visit per device per calendar day so DAU/MAU can be counted.
 * The id is a random token in localStorage — no cookie, no account link, no
 * third-party script. Clearing site data resets it, which is the point.
 * Renders nothing and never blocks the map: any failure is swallowed.
 */
export default function VisitPing() {
  useEffect(() => {
    try {
      let visitorId = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
      if (!isValidVisitorId(visitorId)) {
        visitorId = crypto.randomUUID();
        localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId);
      }
      if (!shouldPing(localStorage.getItem(LAST_PING_STORAGE_KEY), new Date())) return;

      fetch("/api/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
        keepalive: true,
      })
        .then((res) => {
          if (res.ok) localStorage.setItem(LAST_PING_STORAGE_KEY, new Date().toISOString());
        })
        .catch(() => {
          /* counting visitors must never surface an error to the user */
        });
    } catch {
      /* private mode can throw on localStorage access — skip counting */
    }
  }, []);

  return null;
}
