"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { ZoneAggregate } from "@/lib/admin/analytics";

/** Leaflet + OpenStreetMap (no API key). Circle size/colour = report volume per zone. */
export default function CampusMap({
  center,
  zones,
  onSelect,
}: {
  center: { lat: number; lng: number };
  zones: ZoneAggregate[];
  onSelect?: (zoneId: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView([center.lat, center.lng], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    const max = Math.max(1, ...zones.map((z) => z.total));
    for (const z of zones) {
      const t = z.total / max;
      // Yellow → orange → red as intensity rises.
      const color = t > 0.66 ? "#dc2626" : t > 0.33 ? "#f97316" : "#eab308";
      const circle = L.circleMarker([z.lat, z.lng], {
        radius: 10 + t * 30,
        color: z.emergencies ? "#7f1d1d" : color,
        weight: z.emergencies ? 3 : 1,
        fillColor: color,
        fillOpacity: 0.35 + t * 0.4,
      });
      const cats = Object.entries(z.byCategory)
        .map(([c, n]) => `${c}: ${n}`)
        .join("<br/>");
      circle.bindTooltip(
        `<strong>${z.nameEn}</strong><br/>${z.total} report(s), ${z.open} open${z.emergencies ? `, <b style="color:#b91c1c">${z.emergencies} emergency</b>` : ""}<br/>${cats}`,
      );
      circle.on("click", () => onSelect?.(z.zoneId));
      circle.addTo(layer.current);
    }
  }, [zones, onSelect]);

  return <div ref={el} className="h-[60vh] min-h-96 w-full rounded-xl" role="img" aria-label="Campus grievance heatmap" />;
}
