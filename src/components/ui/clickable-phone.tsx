import { Phone, MessageCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

type Props = {
  phone: string;
  className?: string;
};

function formatPhoneForCall(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
}

function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}

export function ClickablePhone({ phone, className }: Props) {
  const handleWhatsApp = () => {
    window.open(`https://wa.me/${formatPhoneForWhatsApp(phone)}`, "_blank");
  };

  const handleCall = () => {
    window.location.href = `tel:${formatPhoneForCall(phone)}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1 hover:text-primary cursor-pointer transition-colors ${className ?? ""}`}
        >
          <Phone className="h-3 w-3" />
          {phone}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-popover">
        <DropdownMenuItem onClick={handleWhatsApp} className="cursor-pointer">
          <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
          Enviar WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCall} className="cursor-pointer">
          <Phone className="h-4 w-4 mr-2 text-blue-600" />
          Ligar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
