import { Mail, Send } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

type Props = {
  email: string;
  className?: string;
};

export function ClickableEmail({ email, className }: Props) {
  const handleSendEmail = () => {
    window.location.href = `mailto:${email}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1 hover:text-primary cursor-pointer transition-colors ${className ?? ""}`}
        >
          <Mail className="h-3 w-3" />
          {email}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-popover">
        <DropdownMenuItem onClick={handleSendEmail} className="cursor-pointer">
          <Send className="h-4 w-4 mr-2 text-blue-600" />
          Enviar E-mail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
