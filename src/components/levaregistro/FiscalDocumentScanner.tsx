import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Barcode,
  Camera,
  CheckCircle,
  Copy,
  FileText,
  Image,
  Loader2,
  QrCode,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type Html5QrcodeResult,
} from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NFCeItem {
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

export interface FiscalDocumentData {
  type: "nfce" | "nfe" | "cupom" | "ean" | "unknown";
  accessKey?: string; // 44 dígitos
  url?: string;
  documentNumber?: string;
  cnpj?: string;
  date?: string;
  totalValue?: number;
  rawData: string;
  // Dados extras da consulta NFC-e
  cpf?: string;
  razaoSocial?: string;
  items?: NFCeItem[];
  // Metadados adicionais
  uf?: string;
  modelo?: string;
  serie?: string;
  ambiente?: string;
  fromCache?: boolean;
  requiresManualInput?: boolean;
}

interface FiscalDocumentScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: FiscalDocumentData) => void;
}

function parseNFCeQRCode(data: string): FiscalDocumentData | null {
  try {
    if (data.includes("nfce") || data.includes("NFCe") || data.includes("sefaz") || data.includes("fazenda")) {
      const urlParams = new URL(data);
      const params = urlParams.searchParams;

      // parâmetro p: chave44digitos|versao|ambiente|csc|hash
      // O valor NÃO está no QR Code - precisa consultar a SEFAZ
      const pParam = params.get("p") || params.get("P") || "";
      const parts = pParam.split("|");

      let accessKey = "";

      if (parts.length > 0) {
        // A chave de acesso são os primeiros 44 dígitos
        accessKey = parts[0].replace(/\D/g, "").substring(0, 44);
      }

      let cnpj = "";
      let date = "";
      if (accessKey.length >= 44) {
        const aamm = accessKey.substring(2, 6);
        cnpj = accessKey.substring(6, 20);
        date = `20${aamm.substring(0, 2)}-${aamm.substring(2, 4)}`;
      }

      // NÃO extrair valor do QR Code - o valor está na página da SEFAZ, não no parâmetro p
      return {
        type: "nfce",
        accessKey,
        url: data, // URL completa do QR Code para consultar a SEFAZ
        cnpj,
        date,
        totalValue: undefined, // Será preenchido após consulta à SEFAZ
        rawData: data,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function parseNFeBarcode(data: string): FiscalDocumentData | null {
  const cleanData = data.replace(/\D/g, "");
  if (cleanData.length === 44) {
    const aamm = cleanData.substring(2, 6);
    const cnpj = cleanData.substring(6, 20);
    const modelo = cleanData.substring(20, 22);
    const numero = cleanData.substring(25, 34);
    const type: FiscalDocumentData["type"] = modelo === "65" ? "nfce" : "nfe";

    return {
      type,
      accessKey: cleanData,
      cnpj,
      date: `20${aamm.substring(0, 2)}-${aamm.substring(2, 4)}`,
      documentNumber: parseInt(numero, 10).toString(),
      rawData: data,
    };
  }
  return null;
}

function parseEAN(data: string): FiscalDocumentData | null {
  const cleanData = data.replace(/\D/g, "");
  if (cleanData.length === 13 || cleanData.length === 8) {
    return { type: "ean", documentNumber: cleanData, rawData: data };
  }
  return null;
}

function parseCupom(data: string): FiscalDocumentData | null {
  if (data.length >= 4 && data.length <= 30) {
    return { type: "cupom", documentNumber: data, rawData: data };
  }
  return null;
}

export function FiscalDocumentScanner({ isOpen, onClose, onScan }: FiscalDocumentScannerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isConsulting, setIsConsulting] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<FiscalDocumentData | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [scanMode, setScanMode] = useState<"auto" | "qr" | "barcode" | "photo">("auto");
  const [hasUserStartedCamera, setHasUserStartedCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);

  const scanModeRef = useRef(scanMode);
  scanModeRef.current = scanMode;

  const startInFlightRef = useRef(false);
  const startSeqRef = useRef(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRegionId = useMemo(
    () => `qr-reader-${Math.random().toString(16).slice(2)}`,
    []
  );

  const consultarNFCe = useCallback(async (data: FiscalDocumentData): Promise<FiscalDocumentData> => {
    // Só consulta NFC-e
    if (data.type !== "nfce" || (!data.url && !data.accessKey)) {
      return data;
    }

    setIsConsulting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("consultar-nfce", {
        body: {
          url: data.url,
          chaveAcesso: data.accessKey,
        },
      });

      if (error) {
        console.error("Erro ao consultar NFC-e:", error);
        return data;
      }

      // Merge dos dados
      return {
        ...data,
        cpf: result?.cpf || data.cpf,
        totalValue: result?.totalValue || data.totalValue,
        items: result?.items || data.items,
        razaoSocial: result?.razaoSocial || data.razaoSocial,
        documentNumber: result?.numeroNota || data.documentNumber,
      };
    } catch (err) {
      console.error("Erro ao consultar NFC-e:", err);
      return data;
    } finally {
      setIsConsulting(false);
    }
  }, []);

  const parseRawCode = useCallback((rawText: string): FiscalDocumentData => {
    let parsedData: FiscalDocumentData | null = null;
    parsedData = parseNFCeQRCode(rawText);
    if (!parsedData) parsedData = parseNFeBarcode(rawText);
    if (!parsedData) parsedData = parseEAN(rawText);
    if (!parsedData) parsedData = parseCupom(rawText);

    return (
      parsedData || {
        type: "unknown",
        rawData: rawText,
      }
    );
  }, []);

  const stop = useCallback(async () => {
    try {
      const inst = scannerRef.current;
      if (!inst) return;
      if (inst.isScanning) {
        await inst.stop();
      }
      try {
        await inst.clear();
      } catch {
        // ignore clear errors
      }
      scannerRef.current = null;
    } catch {
      scannerRef.current = null;
    }
  }, []);

  const handleDecoded = useCallback(
    async (decodedText: string, _result: Html5QrcodeResult) => {
      // Evitar múltiplas leituras seguidas
      await stop();
      setIsLoading(false);
      
      const parsed = parseRawCode(decodedText);
      
      // Se for NFC-e, consulta dados adicionais
      if (parsed.type === "nfce") {
        const enriched = await consultarNFCe(parsed);
        setScannedData(enriched);
      } else {
        setScannedData(parsed);
      }
    },
    [parseRawCode, stop, consultarNFCe]
  );

  const start = useCallback(async () => {
    // Evita corrida de start/stop (muito comum no mobile ao trocar de modo)
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    const seq = ++startSeqRef.current;

    setIsLoading(true);
    setError(null);
    setScannedData(null);

    // Garantir que a div exista
    const el = document.getElementById(scannerRegionId);
    if (!el) {
      setIsLoading(false);
      setError("Área do scanner ainda não foi renderizada.");
      startInFlightRef.current = false;
      return;
    }

    const currentMode = scanModeRef.current;

    const formatsToSupport =
      currentMode === "qr"
        ? [Html5QrcodeSupportedFormats.QR_CODE]
        : currentMode === "barcode"
          ? [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.ITF,
              Html5QrcodeSupportedFormats.DATA_MATRIX,
            ]
          : [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.ITF,
              Html5QrcodeSupportedFormats.DATA_MATRIX,
            ];

    const config: any = {
      fps: currentMode === "qr" ? 8 : 12,
      // Tamanho fixo do quadro de leitura para evitar desalinhamento
      qrbox: currentMode === "barcode" ? { width: 280, height: 100 } : { width: 250, height: 250 },
      // Em alguns Androids o flip pode atrapalhar QR; desligamos no modo QR
      disableFlip: currentMode === "qr",
      experimentalFeatures: {
        // BarcodeDetector às vezes prioriza barras; usar só no modo Barras.
        useBarCodeDetectorIfSupported: currentMode === "barcode",
      },
    };

    const createInstance = () => {
      scannerRef.current = new Html5Qrcode(scannerRegionId, {
        formatsToSupport,
        verbose: false,
      });
      return scannerRef.current;
    };

    const tryStart = async (facingMode: "environment" | "user") => {
      const inst = createInstance();
      await inst.start(
        // O html5-qrcode exige que o 1º parâmetro tenha APENAS uma chave
        { facingMode },
        config,
        handleDecoded,
        // erro de scan contínuo (normal enquanto não encontra)
        () => {}
      );
    };

    try {
      // recriar instância (limpa tracks/canvas anteriores)
      await stop();

      // Se outro start foi solicitado enquanto aguardava o stop, aborta este
      if (seq !== startSeqRef.current) return;

      // iOS/Safari frequentemente falha com facingMode=environment; tentamos fallback.
      try {
        await tryStart("environment");
      } catch (e1: any) {
        console.warn("Falha ao iniciar com câmera traseira; tentando câmera frontal.", {
          name: e1?.name,
          message: e1?.message,
        });
        await stop();
        if (seq !== startSeqRef.current) return;
        await tryStart("user");
      }

      // Se outro start foi solicitado enquanto o start ocorria, não mexe no estado
      if (seq !== startSeqRef.current) return;

      setHasUserStartedCamera(true);
      setIsLoading(false);
    } catch (e: any) {
      console.error("Falha ao iniciar câmera (Html5Qrcode.start):", {
        name: e?.name,
        message: e?.message,
        stack: e?.stack,
      });
      setIsLoading(false);
      setError(
        e?.name
          ? `${e.name}: ${e?.message || "Não foi possível iniciar a câmera."}`
          : e?.message || "Não foi possível iniciar a câmera. Verifique permissões e tente novamente."
      );
    } finally {
      // Só libera se este ainda for o start mais recente
      if (seq === startSeqRef.current) startInFlightRef.current = false;
    }
  }, [handleDecoded, scannerRegionId, stop]);

  useEffect(() => {
    if (!isOpen) {
      // Reset all state when closing
      stop().then(() => {
        startInFlightRef.current = false;
        startSeqRef.current = 0;
      });
      setScannedData(null);
      setManualCode("");
      setManualValue("");
      setError(null);
      setIsLoading(true);
      setIsConsulting(false);
      setHasUserStartedCamera(false);
      setCapturedPhoto(null);
      return;
    }

    // iOS/Safari exige gesto do usuário para abrir a câmera.
    if (isIOS) {
      setIsLoading(false);
      return;
    }

    // Wait for dialog to render and previous cleanup to complete
    const t = setTimeout(() => {
      // Only start if still open and no scanner running
      if (!startInFlightRef.current && !scannerRef.current) {
        start();
      }
    }, 400);

    return () => {
      clearTimeout(t);
    };
  }, [isOpen, isIOS, start, stop]);

  // quando o usuário troca o modo (QR / Barras / Auto), reinicia a câmera
  useEffect(() => {
    if (!isOpen) return;
    if (scannedData) return;
    if (!hasUserStartedCamera) return;

    const t = setTimeout(() => {
      start();
    }, 250);

    return () => clearTimeout(t);
  }, [scanMode, isOpen, scannedData, hasUserStartedCamera, start]);

  const handleConfirm = () => {
    if (!scannedData) return;
    
    // Se o usuário digitou um valor manual, usa ele
    let finalData = { ...scannedData };
    if (manualValue) {
      const parsedValue = parseFloat(manualValue.replace(/\./g, "").replace(",", "."));
      if (!isNaN(parsedValue) && parsedValue > 0) {
        finalData.totalValue = parsedValue;
      }
    }
    
    onScan(finalData);
    onClose();
  };

  const handleRetry = async () => {
    setManualCode("");
    setManualValue("");
    setScannedData(null);
    setCapturedPhoto(null);
    if (scanMode !== "photo") {
      await start();
    }
  };

  const handleManualUse = async () => {
    const rawText = manualCode.trim();
    if (!rawText) return;
    await stop();
    
    const parsed = parseRawCode(rawText);
    
    // Se for NFC-e, consulta dados adicionais
    if (parsed.type === "nfce") {
      const enriched = await consultarNFCe(parsed);
      setScannedData(enriched);
    } else {
      setScannedData(parsed);
    }
  };

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setError(null);

    try {
      // Converter para base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        setCapturedPhoto(base64);

        // Enviar para OCR
        const { data: result, error: ocrError } = await supabase.functions.invoke("ocr-cupom-fiscal", {
          body: { imageBase64: base64 },
        });

        if (ocrError) {
          console.error("Erro OCR:", ocrError);
          toast.error("Erro ao processar imagem. Tente novamente.");
          setIsProcessingPhoto(false);
          return;
        }

        if (!result?.success || !result?.data) {
          toast.error(result?.error || "Não foi possível extrair dados da imagem.");
          setIsProcessingPhoto(false);
          return;
        }

        // Montar dados extraídos
        const extractedData: FiscalDocumentData = {
          type: result.data.accessKey ? "nfce" : "cupom",
          accessKey: result.data.accessKey || undefined,
          cnpj: result.data.cnpj || undefined,
          razaoSocial: result.data.razaoSocial || undefined,
          totalValue: result.data.totalValue || undefined,
          documentNumber: result.data.documentNumber || undefined,
          date: result.data.date || undefined,
          items: result.data.items || undefined,
          rawData: "OCR",
        };

        setScannedData(extractedData);
        toast.success("Dados extraídos com sucesso!");
        setIsProcessingPhoto(false);
      };

      reader.onerror = () => {
        toast.error("Erro ao ler arquivo.");
        setIsProcessingPhoto(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Erro ao processar foto:", err);
      toast.error("Erro ao processar foto.");
      setIsProcessingPhoto(false);
    }
  };

  const handleCopyAccessKey = () => {
    if (scannedData?.accessKey) {
      navigator.clipboard.writeText(scannedData.accessKey);
      toast.success("Chave de acesso copiada!");
    }
  };

  const formatCPF = (cpf: string) => {
    const clean = cpf.replace(/\D/g, "");
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpf;
  };

  const getTypeLabel = (type: FiscalDocumentData["type"]) => {
    switch (type) {
      case "nfce":
        return "NFC-e";
      case "nfe":
        return "NF-e";
      case "cupom":
        return "Cupom";
      case "ean":
        return "Código EAN";
      default:
        return "Desconhecido";
    }
  };

  const getTypeIcon = (type: FiscalDocumentData["type"]) => {
    switch (type) {
      case "nfce":
      case "nfe":
        return <FileText className="h-5 w-5" />;
      case "ean":
        return <Barcode className="h-5 w-5" />;
      default:
        return <QrCode className="h-5 w-5" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-white flex items-center gap-2">
            <Camera className="h-5 w-5 text-amber-500" />
            Ler Documento Fiscal
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Aponte a câmera para o QR Code ou código de barras
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          {!scannedData ? (
            <>
              <div className="mb-3 flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant={scanMode === "auto" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScanMode("auto")}
                  className={scanMode === "auto" ? "bg-amber-500 hover:bg-amber-600" : ""}
                >
                  Auto
                </Button>
                <Button
                  type="button"
                  variant={scanMode === "qr" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScanMode("qr")}
                  className={scanMode === "qr" ? "bg-amber-500 hover:bg-amber-600" : ""}
                >
                  QR
                </Button>
                <Button
                  type="button"
                  variant={scanMode === "barcode" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScanMode("barcode")}
                  className={scanMode === "barcode" ? "bg-amber-500 hover:bg-amber-600" : ""}
                >
                  Barras
                </Button>
                <Button
                  type="button"
                  variant={scanMode === "photo" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setScanMode("photo");
                    stop();
                  }}
                  className={scanMode === "photo" ? "bg-amber-500 hover:bg-amber-600" : ""}
                >
                  <Image className="h-3 w-3 mr-1" />
                  Foto
                </Button>
              </div>

              {/* Modo Foto - Upload/Captura de imagem */}
              {scanMode === "photo" ? (
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                  
                  {isProcessingPhoto ? (
                    <div className="text-center p-4">
                      <Loader2 className="h-10 w-10 animate-spin text-amber-500 mx-auto mb-3" />
                      <p className="text-white font-medium">Analisando cupom...</p>
                      <p className="text-slate-400 text-sm mt-1">Extraindo dados via IA</p>
                    </div>
                  ) : capturedPhoto ? (
                    <div className="relative w-full h-full">
                      <img src={capturedPhoto} alt="Cupom" className="w-full h-full object-contain" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCapturedPhoto(null);
                          fileInputRef.current?.click();
                        }}
                        className="absolute bottom-3 left-1/2 -translate-x-1/2"
                      >
                        Tirar outra foto
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center p-6 space-y-4">
                      <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
                        <Camera className="h-10 w-10 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Fotografar Cupom Fiscal</p>
                        <p className="text-slate-400 text-sm mt-1">
                          Tire uma foto do cupom para extrair os dados automaticamente via IA
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-amber-500 hover:bg-amber-600"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Tirar Foto
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* Modo Scanner - QR/Barcode */
                <div className="relative aspect-square rounded-lg overflow-hidden bg-black">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-2" />
                      <p className="text-sm text-slate-300">Iniciando câmera...</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10 p-4">
                    <div className="w-full space-y-3">
                      <Alert className="border-red-500/30 bg-red-500/10">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <AlertDescription className="text-red-300 text-sm">
                          {error}
                        </AlertDescription>
                      </Alert>
                      <Button
                        type="button"
                        onClick={() => start()}
                        className="w-full bg-amber-500 hover:bg-amber-600"
                      >
                        Tentar novamente
                      </Button>
                    </div>
                  </div>
                )}

                {isIOS && !hasUserStartedCamera && !isLoading && !error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10 p-4">
                    <div className="text-center space-y-3">
                      <p className="text-sm text-slate-200">
                        Toque para permitir acesso à câmera no iPhone.
                      </p>
                      <Button
                        type="button"
                        onClick={() => start()}
                        className="bg-amber-500 hover:bg-amber-600"
                      >
                        Ativar câmera
                      </Button>
                    </div>
                  </div>
                )}

                {/* html5-qrcode renderiza o vídeo aqui */}
                <div id={scannerRegionId} className="absolute inset-0" />
                <style>{`
                  #${scannerRegionId} {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: black;
                  }
                  #${scannerRegionId} video,
                  #${scannerRegionId} canvas {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover;
                  }
                `}</style>

                <div className="absolute inset-0 pointer-events-none">
                  <div
                    className={`absolute ${
                      scanMode === "barcode" ? "inset-x-6 inset-y-16" : "inset-8"
                    } border-2 border-amber-500/50 rounded-lg`}
                  />
                  <div
                    className={`absolute ${
                      scanMode === "barcode" ? "inset-x-6 inset-y-16" : "inset-8"
                    }`}
                  >
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-amber-500 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-amber-500 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-amber-500 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-amber-500 rounded-br-lg" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <Badge variant="outline" className="text-xs">
                    <QrCode className="h-3 w-3 mr-1" />
                    QR Code NFC-e
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Barcode className="h-3 w-3 mr-1" />
                    Código NF-e / EAN
                  </Badge>
                </div>

                {/* manter como fallback */}
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-slate-400">
                    Se não reconhecer, você pode colar a URL/chave aqui.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Cole a URL do QR ou digite a chave/código"
                      className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500"
                    />
                    <Button
                      type="button"
                      onClick={handleManualUse}
                      className="bg-amber-500 hover:bg-amber-600"
                      disabled={isConsulting}
                    >
                      {isConsulting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usar"}
                    </Button>
                  </div>
                </div>
              </div>
              )}
            </>
          ) : (
            <Card className="bg-slate-700/50 border-slate-600">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {isConsulting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                      <span className="text-white">Consultando NFC-e...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-white">Código Lido!</span>
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    {getTypeIcon(scannedData.type)}
                    <span className="ml-1">{getTypeLabel(scannedData.type)}</span>
                  </Badge>
                </div>

                {/* CPF do Consumidor */}
                {scannedData.cpf && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-green-400" />
                      <p className="text-xs text-green-400 font-medium">CPF do Consumidor</p>
                    </div>
                    <p className="text-sm font-mono text-white">
                      {formatCPF(scannedData.cpf)}
                    </p>
                  </div>
                )}

                {/* Valor Total - exibir se disponível ou campo para input manual */}
                {scannedData.totalValue && scannedData.totalValue > 0 ? (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-xs text-amber-400 mb-1">Valor Total</p>
                    <p className="text-xl font-bold text-amber-500">
                      {scannedData.totalValue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-xs text-blue-400 mb-2">
                      💡 Digite o valor total da nota fiscal
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-medium">R$</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={manualValue}
                        onChange={(e) => setManualValue(e.target.value)}
                        placeholder="0,00"
                        className="bg-slate-800 border-blue-500/50 text-white placeholder:text-slate-500 text-lg font-bold"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Confira o valor no cupom impresso ou{" "}
                      <a 
                        href={scannedData.url || `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/NFCeConsultaPublica.aspx?p=${scannedData.accessKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline"
                      >
                        consulte online
                      </a>
                    </p>
                  </div>
                )}

                {/* Itens/Produtos */}
                {scannedData.items && scannedData.items.length > 0 && (
                  <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingCart className="h-4 w-4 text-slate-400" />
                      <p className="text-xs text-slate-400 font-medium">
                        Produtos ({scannedData.items.length})
                      </p>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {scannedData.items.map((item, idx) => (
                        <div key={idx} className="text-xs border-b border-slate-700 pb-2 last:border-0 last:pb-0">
                          <p className="text-white font-medium truncate">{item.descricao}</p>
                          <div className="flex justify-between text-slate-400 mt-1">
                            <span>{item.quantidade} {item.unidade}</span>
                            <span>
                              {item.valorTotal.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chave de Acesso com botão de copiar */}
                {scannedData.accessKey && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-400">Chave de Acesso</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyAccessKey}
                        className="h-6 px-2 text-xs text-slate-400 hover:text-white"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar
                      </Button>
                    </div>
                    <p className="text-xs font-mono text-white break-all bg-slate-800 p-2 rounded">
                      {scannedData.accessKey}
                    </p>
                  </div>
                )}

                {scannedData.documentNumber && !scannedData.accessKey && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Número</p>
                    <p className="text-sm font-semibold text-white">
                      {scannedData.documentNumber}
                    </p>
                  </div>
                )}

                {scannedData.cnpj && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">CNPJ do Estabelecimento</p>
                    <p className="text-sm text-white font-mono">
                      {scannedData.cnpj.replace(
                        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
                        "$1.$2.$3/$4-$5"
                      )}
                    </p>
                  </div>
                )}

                {scannedData.razaoSocial && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Estabelecimento</p>
                    <p className="text-sm text-white">{scannedData.razaoSocial}</p>
                  </div>
                )}

                {scannedData.type === "unknown" && (
                  <Alert className="border-amber-500/30 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <AlertDescription className="text-slate-300 text-xs">
                      Tipo de código não reconhecido. Dados brutos capturados.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={handleRetry} className="flex-1">
                    Ler Outro
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    className="flex-1 bg-amber-500 hover:bg-amber-600"
                    disabled={isConsulting || ((scannedData.type === "nfce" || scannedData.type === "nfe") && !scannedData.totalValue && !manualValue)}
                  >
                    {(scannedData.type === "nfce" || scannedData.type === "nfe") && !scannedData.totalValue && !manualValue 
                      ? "Digite o valor" 
                      : "Usar Este"
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="p-4 pt-0">
          <Button variant="ghost" onClick={onClose} className="w-full text-slate-400">
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
