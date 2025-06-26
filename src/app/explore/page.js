"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function ExplorePage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [reports, setReports] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      try {
        const res = await fetch("/api/report?limit=100");
        const data = await res.json();
        console.log(data.reports[0]);
        setReports(data.reports || []);
      } catch {
        setError("Failed to load reports.");
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  useEffect(() => {
    if (!mounted || !mapContainer.current || !reports.length) return;
    if (mapRef.current) return;

    let stopped = false;
    let tries = 0;
    function tryInitMap() {
      if (stopped) return;
      tries++;
      const el = mapContainer.current;
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        const map = new mapboxgl.Map({
          container: el,
          style: "mapbox://styles/mapbox/streets-v11",
          center: [77.209, 28.6139],
          zoom: 4,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl());

        map.on("load", () => {
          const features = reports.map((r) => ({
            type: "Feature",
            properties: {
              id: r._id,
              title: r.title,
              thumbnail: r.thumbnail,
              status: r.status,
            },
            geometry: {
              type: "Point",
              coordinates: [r.location.lng, r.location.lat],
            },
          }));

          map.addSource("reports", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features,
            },
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50,
          });

          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "reports",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": [
                "step",
                ["get", "point_count"],
                "#22c55e",
                10,
                "#facc15",
                30,
                "#f87171",
              ],
              "circle-radius": [
                "step",
                ["get", "point_count"],
                18,
                10,
                24,
                30,
                32,
              ],
            },
          });

          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "reports",
            filter: ["has", "point_count"],
            layout: {
              "text-field": "{point_count_abbreviated}",
              "text-size": 14,
            },
          });

          map.addLayer({
            id: "unclustered-point",
            type: "circle",
            source: "reports",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": "#2563eb",
              "circle-radius": 10,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            },
          });

          map.on("click", "unclustered-point", (e) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const { id, title } = feature.properties;
            const coords = feature.geometry.coordinates;
            new mapboxgl.Popup()
              .setLngLat(coords)
              .setHTML(
                `<div><strong>${title}</strong><br/><a href="/report/${id}" class="text-blue-600 underline">View Report</a></div>`
              )
              .addTo(map);
          });

          map.on("click", "clusters", (e) => {
            const features = map.queryRenderedFeatures(e.point, {
              layers: ["clusters"],
            });
            const clusterId = features[0].properties.cluster_id;
            map
              .getSource("reports")
              .getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err) return;
                map.easeTo({ center: features[0].geometry.coordinates, zoom });
              });
          });

          map.on("mouseenter", "unclustered-point", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "unclustered-point", () => {
            map.getCanvas().style.cursor = "";
          });

          setTimeout(() => map.resize(), 200);
        });
      } else if (tries < 30) {
        setTimeout(tryInitMap, 100);
      }
    }
    tryInitMap();

    return () => {
      stopped = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mounted, reports]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-foreground">Explore Reports</h1>

      <div className="rounded-xl overflow-hidden border shadow-sm h-[400px]">
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <ScrollArea className="max-h-[420px] rounded-md border p-2">
          <div className="space-y-4">
            {reports.map((report) => (
              <Link key={report._id} href={`/report/${report._id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="p-5 flex gap-6">
                    <img
                      src={report.thumbnail}
                      alt={report.title}
                      className="w-24 h-24 rounded-lg border object-cover flex-shrink-0"
                    />
                    <div className="flex flex-col justify-between gap-2 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-foreground">
                          {report.title}
                        </h3>
                        <Badge
                          variant={
                            report.status === "resolved" ? "success" : "outline"
                          }
                        >
                          {report.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {report.description || "No description provided."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(report.createdAt).toLocaleString()} by{" "}
                        <span className="font-medium text-primary">
                          {report.createdBy}
                        </span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
