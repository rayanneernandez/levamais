import { QRCodeSVG } from "qrcode.react";
import { Building2, User, Gift, Star } from "lucide-react";

interface PrintableQRCodeProps {
  qrCodeUrl: string;
  storeName: string;
  attendantName: string;
  loyaltyType?: string;
}

export const PrintableQRCode = ({ qrCodeUrl, storeName, attendantName, loyaltyType }: PrintableQRCodeProps) => {
  return (
    <div 
      id="printable-qr-code" 
      className="bg-white p-6 rounded-lg shadow-xl max-w-sm mx-auto"
      style={{ width: '350px' }}
    >
      {/* Header com Branding */}
      <div className="text-center mb-4 border-b-4 border-primary pb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Gift className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-primary">Leva+</h1>
        </div>
        <p className="text-base font-semibold text-gray-700">Programa de Fidelidade</p>
      </div>

      {/* Informações da Loja */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="font-bold text-base text-gray-800">{storeName}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <User className="h-3 w-3" />
          <span>Atendente: {attendantName}</span>
        </div>
      </div>

      {/* Instruções */}
      <div className="text-center mb-4">
        <h3 className="font-bold text-lg mb-2 text-gray-800">
          Escaneie e Ganhe!
        </h3>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          <p className="text-xs text-gray-600">
            {loyaltyType === 'points' ? 'Acumule pontos a cada compra' : 'Ganhe cashback nas suas compras'}
          </p>
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        </div>
      </div>

      {/* QR Code */}
      <div className="flex justify-center mb-4">
        <div className="bg-white p-3 rounded-lg border-4 border-primary shadow-lg">
          <QRCodeSVG
            value={qrCodeUrl}
            size={160}
            level="H"
            includeMargin={true}
          />
        </div>
      </div>

      {/* Passos */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <h4 className="font-semibold text-center mb-2 text-gray-800 text-sm">Como usar:</h4>
        <ol className="space-y-1.5 text-xs text-gray-700">
          <li className="flex gap-2">
            <span className="font-bold text-primary min-w-[16px]">1.</span>
            <span>Escaneie o QR Code com a câmera do seu celular</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary min-w-[16px]">2.</span>
            <span>Complete seu cadastro no site</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary min-w-[16px]">3.</span>
            <span>Comece a acumular benefícios!</span>
          </li>
        </ol>
      </div>

      {/* Footer */}
      <div className="text-center pt-3 border-t-2 border-gray-200">
        <p className="text-[10px] text-gray-500 font-medium">
          www.levamaisfidelidade.com.br
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          Seus benefícios na palma da mão
        </p>
      </div>
    </div>
  );
};