import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { MapPin, Phone, Clock } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Store {
  id: string;
  name: string;
  address: string;
  contact_phone?: string;
}

interface StoreMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  networkName: string;
  stores: Store[];
}

export function StoreMapDialog({ open, onOpenChange, networkName, stores }: StoreMapDialogProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!open || !mapContainer.current) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [
            position.coords.longitude,
            position.coords.latitude,
          ];
          setUserLocation(coords);
        },
        (error) => {
          console.log('Geolocation error:', error);
          // Default to Brazil center if geolocation fails
          setUserLocation([-47.9292, -15.7801]);
        }
      );
    } else {
      // Default to Brazil center if geolocation not supported
      setUserLocation([-47.9292, -15.7801]);
    }
  }, [open]);

  useEffect(() => {
    if (!userLocation || !mapContainer.current || !open) return;

    // Initialize map centered on user location
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: userLocation,
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add user location marker
    new mapboxgl.Marker({ color: '#3B82F6' })
      .setLngLat(userLocation)
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div class="p-2">
            <h3 class="font-semibold">Você está aqui</h3>
          </div>`
        )
      )
      .addTo(map.current);

    return () => {
      map.current?.remove();
    };
  }, [userLocation, stores, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Lojas - {networkName}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 h-[600px]">
          {/* Lista de lojas */}
          <div className="overflow-y-auto space-y-3 pr-2">
            {stores.map((store) => (
              <Card
                key={store.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedStore?.id === store.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedStore(store)}
              >
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{store.name}</h3>

                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{store.address}</span>
                  </div>

                  {store.contact_phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span>{store.contact_phone}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Mapa */}
          <div className="relative rounded-lg overflow-hidden border">
            <div ref={mapContainer} className="absolute inset-0" />
            {stores.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                <p className="text-muted-foreground">Nenhuma loja disponível</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: informação da loja selecionada */}
        {selectedStore && (
          <div className="md:hidden mt-4 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-semibold mb-2">{selectedStore.name}</h4>
            <p className="text-sm text-muted-foreground">{selectedStore.address}</p>
            {selectedStore.contact_phone && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedStore.contact_phone}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
