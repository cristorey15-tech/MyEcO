import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useConfirm } from '@/hooks/useConfirm';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit3, Trash2, Palette, Search } from 'lucide-react';
import type { Category } from '@/types';
import {
  Briefcase, Laptop, TrendingUp, Gift, PlusCircle,
  Utensils, Car, Home, Zap, Heart, Film, Book, ShoppingBag, Plane,
  MoreHorizontal, Shield, FileText, Music, Camera, Smartphone,
  Dumbbell, Wifi, Coffee, Star,
} from 'lucide-react';

const CATEGORY_ICONS = [
  { name: 'briefcase', component: Briefcase }, { name: 'laptop', component: Laptop },
  { name: 'trending-up', component: TrendingUp }, { name: 'gift', component: Gift },
  { name: 'plus-circle', component: PlusCircle }, { name: 'utensils', component: Utensils },
  { name: 'car', component: Car }, { name: 'home', component: Home },
  { name: 'zap', component: Zap }, { name: 'heart', component: Heart },
  { name: 'film', component: Film }, { name: 'book', component: Book },
  { name: 'shopping-bag', component: ShoppingBag }, { name: 'plane', component: Plane },
  { name: 'more-horizontal', component: MoreHorizontal }, { name: 'file-text', component: FileText },
  { name: 'shield', component: Shield }, { name: 'music', component: Music },
  { name: 'camera', component: Camera }, { name: 'smartphone', component: Smartphone },
  { name: 'dumbbell', component: Dumbbell }, { name: 'wifi', component: Wifi },
  { name: 'coffee', component: Coffee }, { name: 'star', component: Star },
];

function getIconComponent(iconName: string) {
  return CATEGORY_ICONS.find(i => i.name === iconName)?.component || PlusCircle;
}

export function CategoriesSection() {
  const { t } = useTranslation();
  const { confirm, ConfirmDialog } = useConfirm();
  const categories = useLiveQuery(() => db.categories.toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: '', type: 'expense' as 'income' | 'expense', categoryType: 'need' as 'need' | 'want' | undefined, icon: 'plus-circle', color: '#2563eb' });
  const [catFormErrors, setCatFormErrors] = useState<Record<string, string>>({});
  const [catSearchTerm, setCatSearchTerm] = useState('');

  const catTxCounts = useMemo(() => {
    if (!transactions) return {} as Record<number, number>;
    const counts: Record<number, number> = {};
    for (const tx of transactions) { counts[tx.categoryId] = (counts[tx.categoryId] || 0) + 1; }
    return counts;
  }, [transactions]);

  const filteredCategories = useMemo(() => {
    if (!categories) return { income: [] as Category[], expense: [] as Category[] };
    const income = categories.filter(c => c.type === 'income');
    const expense = categories.filter(c => c.type === 'expense');
    if (!catSearchTerm) return { income, expense };
    const term = catSearchTerm.toLowerCase();
    return { income: income.filter(c => c.name.toLowerCase().includes(term)), expense: expense.filter(c => c.name.toLowerCase().includes(term)) };
  }, [categories, catSearchTerm]);

  const openNewCategory = () => { setEditingCategory(null); setCatFormErrors({}); setCatForm({ name: '', type: 'expense', categoryType: 'need', icon: 'plus-circle', color: '#2563eb' }); setCategoryModalOpen(true); };
  const openEditCategory = (cat: Category) => { setEditingCategory(cat); setCatFormErrors({}); setCatForm({ name: cat.name, type: cat.type, categoryType: cat.categoryType || (cat.type === 'expense' ? 'need' : undefined), icon: cat.icon || 'plus-circle', color: cat.color }); setCategoryModalOpen(true); };

  const saveCategory = async () => {
    const errors: Record<string, string> = {};
    if (!catForm.name.trim()) errors.name = t('validation.required');
    setCatFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (editingCategory) { await db.categories.update(editingCategory.id!, { name: catForm.name, color: catForm.color, icon: catForm.icon, categoryType: catForm.type === 'expense' ? catForm.categoryType : undefined }); }
    else { await db.categories.add({ name: catForm.name, type: catForm.type, categoryType: catForm.type === 'expense' ? catForm.categoryType : undefined, icon: catForm.icon || 'plus-circle', color: catForm.color, isDefault: false, createdAt: new Date() }); }
    setCategoryModalOpen(false);
  };

  const deleteCategory = async (id: number) => {
    const confirmed = await confirm({ title: t('common.delete') + ' ' + t('common.category'), message: '¿Eliminar esta categoría permanentemente?', confirmLabel: t('common.delete'), variant: 'danger' });
    if (confirmed) await db.categories.delete(id);
  };

  const renderCategoryChips = (cats: Category[]) => (
    <div className="flex flex-wrap gap-2">
      {cats.length > 0 ? cats.map(cat => {
        const IconComp = getIconComponent(cat.icon);
        const txCount = catTxCounts[cat.id!] || 0;
        return (
          <div key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 text-sm group hover:shadow-sm transition-shadow" style={{ borderColor: cat.color + '30' }}>
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}><IconComp className="w-3 h-3" style={{ color: cat.color }} /></div>
            <span className="font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
            <Badge variant="default" className="text-[10px] px-1.5 py-0">{txCount > 0 ? t('settings.catUsage', { count: txCount }) : t('settings.catNoUsage')}</Badge>
            <div className="flex ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip content={t('common.edit')}><button onClick={() => openEditCategory(cat)} className="p-0.5 text-gray-400 hover:text-gray-600"><Edit3 className="w-3 h-3" /></button></Tooltip>
              <Tooltip content={t('common.delete')}><button onClick={() => deleteCategory(cat.id!)} className="p-0.5 text-gray-400 hover:text-danger"><Trash2 className="w-3 h-3" /></button></Tooltip>
            </div>
          </div>
        );
      }) : <p className="text-xs text-gray-400 italic">—</p>}
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Palette className="w-5 h-5 text-primary" /><h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.categories')}</h2></div>
            <Tooltip content={t('settings.newCategory')}><Button size="sm" onClick={openNewCategory}><Plus className="w-4 h-4" />{t('settings.newCategory')}</Button></Tooltip>
          </div>
          <div className="relative mt-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /><input className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-gray-800 transition-colors" placeholder={t('settings.catSearchPlaceholder')} value={catSearchTerm} onChange={(e) => setCatSearchTerm(e.target.value)} /></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('common.income')} ({filteredCategories.income.length})</h3>{renderCategoryChips(filteredCategories.income)}</div>
          <div><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('common.expense')} ({filteredCategories.expense.length})</h3>{renderCategoryChips(filteredCategories.expense)}</div>
        </CardContent>
      </Card>
      <Modal isOpen={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title={editingCategory ? t('common.edit') + ' ' + t('common.category') : t('settings.newCategory')} size="lg" footer={<><Button variant="ghost" onClick={() => setCategoryModalOpen(false)}>{t('common.cancel')}</Button><Button onClick={saveCategory}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          <Input label={t('common.name')} value={catForm.name} onChange={(e) => { setCatForm(prev => ({ ...prev, name: e.target.value })); setCatFormErrors({}); }} error={catFormErrors.name} />
          {!editingCategory && <Select label={t('common.type')} value={catForm.type} onChange={(e) => setCatForm(prev => ({ ...prev, type: e.target.value as 'income' | 'expense' }))} options={[{ value: 'expense', label: t('common.expense') }, { value: 'income', label: t('common.income') }]} />}
          <Input label="Color" type="color" value={catForm.color} onChange={(e) => setCatForm(prev => ({ ...prev, color: e.target.value }))} />
          {catForm.type === 'expense' && (<>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('fiftyThirtyTwenty.categoryType')}</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCatForm(prev => ({ ...prev, categoryType: 'need' as const }))} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${catForm.categoryType === 'need' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500/30' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'}`}><span className="block text-xs">{t('fiftyThirtyTwenty.need')}</span><span className="block text-[10px] opacity-70">{t('fiftyThirtyTwenty.needDesc')}</span></button>
              <button type="button" onClick={() => setCatForm(prev => ({ ...prev, categoryType: 'want' as const }))} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${catForm.categoryType === 'want' ? 'border-purple-500 bg-purple-50 text-purple-700 ring-1 ring-purple-500/30' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'}`}><span className="block text-xs">{t('fiftyThirtyTwenty.want')}</span><span className="block text-[10px] opacity-70">{t('fiftyThirtyTwenty.wantDesc')}</span></button>
            </div>
          </>)}
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.catIcon')}</label><div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">{CATEGORY_ICONS.map(({ name, component: IconComp }) => (<button key={name} type="button" onClick={() => setCatForm(prev => ({ ...prev, icon: name }))} className={`p-2 rounded-lg border transition-all ${catForm.icon === name ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30' : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`} title={name}><IconComp className="w-4 h-4 mx-auto" /></button>))}</div></div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">{(() => { const PreviewIcon = getIconComponent(catForm.icon); return (<><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: catForm.color + '20' }}><PreviewIcon className="w-4 h-4" style={{ color: catForm.color }} /></div><span className="text-sm font-medium text-gray-700 dark:text-gray-300">{catForm.name || '(preview)'}</span><span className="text-xs text-gray-400 dark:text-gray-500">{catForm.type === 'income' ? t('common.income') : t('common.expense')}</span></>); })()}</div>
        </div>
      </Modal>
      {ConfirmDialog}
    </>
  );
}
