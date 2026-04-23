"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Html5Qrcode } from "html5-qrcode";

const scannerElementId = "pharmaflow-barcode-scanner";

type ScannerStatus =
  | "idle"
  | "loading"
  | "active"
  | "permission_denied"
  | "success"
  | "error";

type BarcodeScannerProps = {
  initialCode?: string;
};

export function BarcodeScanner({ initialCode = "" }: BarcodeScannerProps) {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastDecodedRef = useRef("");
  const [manualCode, setManualCode] = useState(initialCode);
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("idle");
  const [feedback, setFeedback] = useState<string | null>(
    "Point the rear camera at a barcode or QR code.",
  );
  const [selectedCameraLabel, setSelectedCameraLabel] = useState<string | null>(null);
  const [lastSuccessCode, setLastSuccessCode] = useState<string | null>(null);

  const hasCode = useMemo(() => Boolean(manualCode.trim()), [manualCode]);
  const isStarting = scannerStatus === "loading";
  const isScanning = scannerStatus === "active";

  useEffect(() => {
    setManualCode(initialCode);
  }, [initialCode]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      void stopScanner();
    };
  }, []);

  async function stopScanner(nextStatus: ScannerStatus = "idle") {
    if (!scannerRef.current) {
      if (mountedRef.current) {
        setScannerStatus(nextStatus);
      }
      return;
    }

    try {
      await scannerRef.current.stop();
    } catch {}

    try {
      await Promise.resolve(scannerRef.current.clear());
    } catch {}

    scannerRef.current = null;
    processingRef.current = false;

    if (mountedRef.current) {
      setScannerStatus(nextStatus);
      setSelectedCameraLabel(null);
    }
  }

  function getScannerErrorMessage(error: unknown) {
    const message =
      error instanceof Error ? error.message : "Scanner could not be started.";
    const normalizedMessage = message.toLowerCase();

    if (
      normalizedMessage.includes("permission") ||
      normalizedMessage.includes("notallowederror") ||
      normalizedMessage.includes("denied")
    ) {
      return "Camera permission was denied. Allow camera access and try again.";
    }

    if (
      normalizedMessage.includes("camera not found") ||
      normalizedMessage.includes("no camera") ||
      normalizedMessage.includes("notfounderror")
    ) {
      return "No camera is available on this device.";
    }

    return `Scanner failed to start. ${message}`;
  }

  async function requestCameraAccess() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error("Camera access is not supported in this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });

    stream.getTracks().forEach((track) => track.stop());
  }

  function pickPreferredCameraId(
    cameras: Array<{
      id: string;
      label: string;
    }>,
  ) {
    const preferredCamera =
      cameras.find((camera) =>
        /back|rear|environment|world/i.test(camera.label),
      ) ?? cameras[cameras.length - 1];

    return preferredCamera ?? null;
  }

  async function startScanner() {
    if (isScanning || isStarting) {
      return;
    }

    console.debug("[pharmaflow-scan] scanner start requested");
    setFeedback("Starting camera...");
    setScannerStatus("loading");
    setLastSuccessCode(null);

    try {
      await requestCameraAccess();
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const cameras = await Html5Qrcode.getCameras();
      const preferredCamera = pickPreferredCameraId(cameras);

      if (!preferredCamera && cameras.length === 0) {
        throw new Error("No camera is available on this device.");
      }

      const scanner = new Html5Qrcode(scannerElementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });

      scannerRef.current = scanner;
      console.debug("[pharmaflow-scan] selected camera", {
        cameraId: preferredCamera?.id ?? null,
        cameraLabel: preferredCamera?.label ?? null,
        availableCameras: cameras.map((camera) => ({
          id: camera.id,
          label: camera.label,
        })),
      });

      await scanner.start(
        preferredCamera?.id
          ? preferredCamera.id
          : { facingMode: { ideal: "environment" } },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const boxWidth = Math.min(viewfinderWidth - 32, 300);
            const boxHeight = Math.min(viewfinderHeight - 32, 300);

            return {
              width: Math.max(220, boxWidth),
              height: Math.max(220, boxHeight),
            };
          },
          aspectRatio: 1,
        },
        async (decodedText) => {
          console.debug("[pharmaflow-scan] scan callback fired", {
            decodedText,
          });

          const normalizedText = decodedText.trim();

          if (
            processingRef.current ||
            !normalizedText ||
            normalizedText === lastDecodedRef.current
          ) {
            return;
          }

          processingRef.current = true;
          lastDecodedRef.current = normalizedText;
          console.debug("[pharmaflow-scan] decoded result received", {
            decodedText: normalizedText,
          });

          if (mountedRef.current) {
            setManualCode(normalizedText);
            setLastSuccessCode(normalizedText);
            setFeedback(`Detected code: ${normalizedText}`);
            setScannerStatus("success");
          }

          await stopScanner("success");
          router.push(`/scan?code=${encodeURIComponent(normalizedText)}`);
        },
        () => {},
      );

      if (mountedRef.current) {
        setScannerStatus("active");
        setSelectedCameraLabel(preferredCamera?.label ?? "Default camera");
        setFeedback("Scanner is live. No code detected yet.");
      }
    } catch (error) {
      console.debug("[pharmaflow-scan] scanner init failure", {
        error,
      });

      const nextMessage = getScannerErrorMessage(error);
      const nextStatus = nextMessage.toLowerCase().includes("permission")
        ? "permission_denied"
        : "error";

      if (mountedRef.current) {
        setFeedback(nextMessage);
        setScannerStatus(nextStatus);
      }

      await stopScanner(nextStatus);
    }
  }

  function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextCode = manualCode.trim();

    if (!nextCode) {
      setFeedback("Enter a barcode to search manually.");
      setScannerStatus("error");
      return;
    }

    setFeedback(null);
    router.push(`/scan?code=${encodeURIComponent(nextCode)}`);
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-lg font-semibold text-slate-950">Camera scanner</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Open the device camera, point it at a QR code or barcode, and jump straight into stock actions.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void startScanner()}
            disabled={isStarting || isScanning}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStarting ? "Starting camera..." : isScanning ? "Scanner active" : "Start scanning"}
          </button>

          {isScanning ? (
            <button
              type="button"
              onClick={() => void stopScanner("idle")}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Stop camera
            </button>
          ) : null}
        </div>
      </div>

      {feedback ? (
        <p
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
            scannerStatus === "permission_denied" || scannerStatus === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : scannerStatus === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {feedback}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
          {scannerStatus === "loading"
            ? "Initializing camera"
            : scannerStatus === "active"
              ? "Scanner active"
              : scannerStatus === "permission_denied"
                ? "Permission denied"
                : scannerStatus === "success"
                  ? "Scan success"
                  : scannerStatus === "error"
                    ? "Scanner error"
                    : "Scanner idle"}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
          {selectedCameraLabel ? `Camera: ${selectedCameraLabel}` : "Rear camera preferred on mobile"}
        </span>
        {lastSuccessCode ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
            Last code: {lastSuccessCode}
          </span>
        ) : null}
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-slate-950">
        <div
          id={scannerElementId}
          className="min-h-[320px] w-full bg-slate-950 [&_canvas]:h-[320px] [&_canvas]:w-full [&_canvas]:object-cover [&_video]:h-[320px] [&_video]:w-full [&_video]:object-cover"
        />
      </div>

      <form onSubmit={handleManualSubmit} className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-800" htmlFor="manualBarcode">
            Manual barcode entry
          </label>
          <input
            id="manualBarcode"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder="Enter or paste barcode"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!hasCode}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
          >
            Search code
          </button>
        </div>
      </form>
    </section>
  );
}
