import { 
  Wallet, CreditCard, PiggyBank, TrendingUp, Briefcase, Laptop, Gift,
  PlusCircle, Utensils, Car, Home, Zap, Heart, Film, Book, ShoppingBag,
  Plane, Repeat, FileText, MoreHorizontal, Target, DollarSign, ArrowUpRight,
  ArrowDownRight, ArrowLeftRight, Trash2, Edit3, Plus, Search, Filter,
  Download, Upload, Settings, PieChart, BarChart3, LineChart, Calendar,
  CheckCircle2, AlertCircle, Clock, Users, type LucideIcon
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  wallet: Wallet,
  'credit-card': CreditCard,
  'piggy-bank': PiggyBank,
  'trending-up': TrendingUp,
  briefcase: Briefcase,
  laptop: Laptop,
  gift: Gift,
  'plus-circle': PlusCircle,
  utensils: Utensils,
  car: Car,
  home: Home,
  zap: Zap,
  heart: Heart,
  film: Film,
  book: Book,
  'shopping-bag': ShoppingBag,
  plane: Plane,
  repeat: Repeat,
  'file-text': FileText,
  'more-horizontal': MoreHorizontal,
  target: Target,
  'dollar-sign': DollarSign,
  'arrow-up-right': ArrowUpRight,
  'arrow-down-right': ArrowDownRight,
  'arrow-left-right': ArrowLeftRight,
  trash: Trash2,
  'edit': Edit3,
  plus: Plus,
  search: Search,
  filter: Filter,
  download: Download,
  upload: Upload,
  settings: Settings,
  'pie-chart': PieChart,
  'bar-chart': BarChart3,
  'line-chart': LineChart,
  calendar: Calendar,
  'check-circle': CheckCircle2,
  'alert-circle': AlertCircle,
  clock: Clock,
  users: Users,
};

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

export function Icon({ name, className = 'w-5 h-5', size }: IconProps) {
  const IconComponent = iconMap[name];
  if (!IconComponent) return null;
  return <IconComponent className={className} style={size ? { width: size, height: size } : undefined} />;
}

export { 
  Wallet, CreditCard, PiggyBank, TrendingUp, Briefcase, Laptop, Gift,
  PlusCircle, Utensils, Car, Home, Zap, Heart, Film, Book, ShoppingBag,
  Plane, Repeat, FileText, MoreHorizontal, Target, DollarSign, ArrowUpRight,
  ArrowDownRight, ArrowLeftRight, Trash2, Edit3, Plus, Search, Filter,
  Download, Upload, Settings, PieChart, BarChart3, LineChart, Calendar,
  CheckCircle2, AlertCircle, Clock, Users
};
