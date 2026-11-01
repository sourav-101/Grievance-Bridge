/**
 * Line icons in the india.gov.in style: thin red outline icons on white cards,
 * or white icons on red rounded tiles (IconTile). Built on lucide-react.
 */
import {
  AudioLines,
  CircleCheck,
  FolderClock,
  Hand,
  HardHat,
  House,
  IdCard,
  IndianRupee,
  Landmark,
  Megaphone,
  MessageCircleMore,
  Mic,
  Droplets,
  Scale,
  Siren,
  Stethoscope,
  Ticket,
  UserRound,
  VenetianMask,
  type LucideIcon,
} from "lucide-react";
import type { GrievanceCategory } from "@/lib/types";

type P = { className?: string; title?: string };

/** Red outline icon (default) — pass a text-* class to recolour. */
function line(Icon: LucideIcon) {
  const Comp = ({ className = "", title }: P) => (
    <Icon className={`text-brand ${className}`} strokeWidth={1.6} aria-hidden={title ? undefined : true} aria-label={title} />
  );
  return Comp;
}

export const SchemesPicto = line(Landmark);
export const WagesPicto = line(IndianRupee);
export const HealthPicto = line(Stethoscope);
export const GrievancePicto = line(Megaphone);
export const HistoryPicto = line(FolderClock);
export const TokenPicto = line(Ticket);
export const DocumentsPicto = line(IdCard);
export const RightsPicto = line(Scale);
export const HomePicto = line(House);
export const AnonymousPicto = line(VenetianMask);

export const CATEGORY_ICON: Record<GrievanceCategory, LucideIcon> = {
  "Wage Dispute": IndianRupee,
  "Safety/PPE": HardHat,
  Sanitation: Droplets,
  Harassment: Hand,
  General: MessageCircleMore,
};

export function CategoryPicto({ category, className = "" }: { category: GrievanceCategory; className?: string }) {
  const Icon = CATEGORY_ICON[category];
  return <Icon className={`text-brand ${className}`} strokeWidth={1.6} aria-hidden />;
}

/** india.gov.in "Information Categories" tile: red rounded square with a white line icon. */
export function IconTile({ icon: Icon, size = "md", tone = "brand", className = "" }: { icon: LucideIcon; size?: "sm" | "md" | "lg"; tone?: "brand" | "indigo" | "iitr"; className?: string }) {
  const box = size === "lg" ? "size-16 rounded-xl" : size === "sm" ? "size-10 rounded-lg" : "size-13 rounded-lg";
  const icon = size === "lg" ? "size-9" : size === "sm" ? "size-5" : "size-7";
  const bg =
    tone === "indigo" ? "bg-gradient-to-br from-brand-light to-indigo-soft" : tone === "iitr" ? "bg-iitr" : "bg-gradient-to-br from-brand-light to-brand-dark";
  return (
    <span className={`grid shrink-0 place-items-center text-white shadow-sm ${bg} ${box} ${className}`}>
      <Icon className={icon} strokeWidth={1.6} aria-hidden />
    </span>
  );
}
