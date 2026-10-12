"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing } from "lucide-react";
import { deleteSubscription, saveAlertPrefs, saveSubscription, sendTestAlert, type AlertResult } from "./actions";

type Support = "checking" | "unsupported" | "needs-install" | "denied" | "ready";

/** VAPID public keys are URL-safe base64; PushManager wants the raw bytes. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function deviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Browser";
  return `${os}, added ${new Date().toLocaleDateString("en-PH")}`;
}

export function AlertsForm({ publicKey, prefs, devices }: { publicKey: string | null; prefs: { bills: boolean; spending: boolean }; devices: number }) {
  const [support, setSupport] = useState<Support>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [choice, setChoice] = useState(prefs);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const check = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iPhones only allow alerts for apps added to the Home Screen.
        const ios = /iPhone|iPad/.test(navigator.userAgent);
        setSupport(ios ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setSupport("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
      setSupport("ready");
    };
    check().catch(() => setSupport("unsupported"));
  }, []);

  const report = (result: AlertResult, ok: string) =>
    setMessage(result.ok ? { text: ok, error: false } : { text: result.message, error: true });

  const turnOn = () =>
    start(async () => {
      if (!publicKey) return;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSupport(permission === "denied" ? "denied" : "ready");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const result = await saveSubscription({ ...sub.toJSON(), device: deviceName() });
      if (result.ok) setSubscribed(true);
      report(result, "Alerts are on for this device.");
    });

  const turnOff = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deleteSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMessage({ text: "Alerts are off for this device.", error: false });
    });

  const toggle = (key: "bills" | "spending") =>
    start(async () => {
      const next = { ...choice, [key]: !choice[key] };
      setChoice(next);
      report(await saveAlertPrefs(next), "Saved.");
    });

  if (!publicKey) return <p className="settings-p">Alerts aren&apos;t set up on this server yet.</p>;

  return (
    <div className="alerts-form">
      {support === "needs-install" && (
        <p className="settings-p">
          On iPhone, alerts work once Budget is on your Home Screen: tap Share, then Add to Home Screen, and open Budget from there.
        </p>
      )}
      {support === "unsupported" && <p className="settings-p">This browser can&apos;t show alerts. Try Chrome on Android, or Budget from your iPhone&apos;s Home Screen.</p>}
      {support === "denied" && (
        <p className="settings-p">Notifications are blocked for Budget. Allow them in your browser&apos;s site settings, then come back.</p>
      )}
      {support === "ready" &&
        (subscribed ? (
          <div className="alerts-actions">
            <button type="button" className="btn" onClick={() => start(async () => report(await sendTestAlert(), "Sent. It should arrive in a few seconds."))} disabled={pending}>
              <BellRing aria-hidden />
              Send a test alert
            </button>
            <button type="button" className="btn" onClick={turnOff} disabled={pending}>
              <BellOff aria-hidden />
              Turn off on this device
            </button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={turnOn} disabled={pending}>
            <BellRing aria-hidden />
            Turn on alerts on this device
          </button>
        ))}

      {(subscribed || devices > 0) && (
      <fieldset className="alert-prefs">
        <legend className="vh">What to be alerted about</legend>
        <label>
          <input type="checkbox" checked={choice.bills} onChange={() => toggle("bills")} disabled={pending} />
          <span>
            <b>Bills due</b>
            <span className="hint">3 days and 1 day before, on the day, and if one is late</span>
          </span>
        </label>
        <label>
          <input type="checkbox" checked={choice.spending} onChange={() => toggle("spending")} disabled={pending} />
          <span>
            <b>Spending</b>
            <span className="hint">When today&apos;s amount runs out, and when a category nears or passes its limit</span>
          </span>
        </label>
      </fieldset>
      )}
      <p className="hint">
        {devices === 0 ? "No devices have alerts on yet." : `${devices} ${devices === 1 ? "device has" : "devices have"} alerts on.`} No alerts between 10 PM and 8 AM.
      </p>
      <p className={message?.error ? "form-error" : "form-note"} role="status" aria-live="polite">{message?.text ?? ""}</p>
    </div>
  );
}
