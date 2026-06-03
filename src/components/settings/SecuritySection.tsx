import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/useAppStore';
import { useToastStore } from '@/stores/useToastStore';
import { useConfirm } from '@/hooks/useConfirm';
import { hashPin, hashAnswer, isBiometricAvailable, registerBiometric, removeBiometricCredential } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Lock, KeyRound, Trash2, Fingerprint, Edit3 } from 'lucide-react';

export function SecuritySection() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const { confirm, ConfirmDialog } = useConfirm();
  const {
    pinHash, setPinHash, pinLength, setPinLength, lockEnabled, setLockEnabled,
    biometricEnabled, setBiometricEnabled, securityQuestions, setSecurityQuestions, userName,
  } = useAppStore();

  const [pinModalMode, setPinModalMode] = useState<'set' | 'change' | 'remove' | null>(null);
  const [pinForm, setPinForm] = useState({ currentPin: '', newPin: '', confirmPin: '' });
  const [pinFormErrors, setPinFormErrors] = useState<Record<string, string>>({});
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioRegistered, setBioRegistered] = useState(!!localStorage.getItem('myeco-biometric-credential'));
  const [secQModalOpen, setSecQModalOpen] = useState(false);
  const [secQList, setSecQList] = useState<{ question: string; answer: string }[]>([{ question: '', answer: '' }]);
  const [secQErrors, setSecQErrors] = useState<Record<string, string>>({});

  const PREDEFINED_QUESTIONS = [
    { value: 'pet', label: t('security.qPet') }, { value: 'city', label: t('security.qCity') },
    { value: 'mother', label: t('security.qMother') }, { value: 'school', label: t('security.qSchool') },
    { value: 'friend', label: t('security.qFriend') }, { value: 'custom', label: t('security.qCustom') },
  ];

  useEffect(() => { isBiometricAvailable().then(setBioAvailable); }, []);

  const handleRegisterBiometric = async () => {
    const success = await registerBiometric(userName || 'MyEco User');
    if (success) { setBioRegistered(true); setBiometricEnabled(true); addToast({ title: t('security.biometricRegistered'), variant: 'success' }); }
    else { addToast({ title: t('security.biometricNotAvailable'), variant: 'error' }); }
  };

  const handleSavePin = async () => {
    const errors: Record<string, string> = {};
    if (pinModalMode === 'change' || pinModalMode === 'remove') {
      if (!pinForm.currentPin) errors.currentPin = t('validation.required');
      else if (pinHash) { const isValid = await hashPin(pinForm.currentPin).then(h => h === pinHash); if (!isValid) errors.currentPin = t('security.wrongPin'); }
    }
    if (pinModalMode === 'set' || pinModalMode === 'change') {
      if (!pinForm.newPin) errors.newPin = t('security.pinRequired');
      else if (pinForm.newPin.length < pinLength) errors.newPin = t('security.pinTooShort', { digits: pinLength });
      else if (pinForm.newPin !== pinForm.confirmPin) errors.confirmPin = t('security.pinMismatch');
    }
    setPinFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (pinModalMode === 'remove') { setPinHash(''); setLockEnabled(false); setBiometricEnabled(false); removeBiometricCredential(); setBioRegistered(false); }
    else if (pinModalMode === 'set' || pinModalMode === 'change') { const newHash = await hashPin(pinForm.newPin); setPinHash(newHash); setLockEnabled(true); }
    setPinModalMode(null); setPinForm({ currentPin: '', newPin: '', confirmPin: '' }); setPinFormErrors({});
  };

  const openSecQuestions = () => {
    setSecQList(securityQuestions.length > 0 ? securityQuestions.map(q => ({ question: q.question, answer: '' })) : [{ question: '', answer: '' }, { question: '', answer: '' }]);
    setSecQErrors({}); setSecQModalOpen(true);
  };

  const handleSaveSecQuestions = async () => {
    const errors: Record<string, string> = {};
    const validQuestions: { question: string; answerHash: string }[] = [];
    const predefinedMap: Record<string, string> = {};
    for (const pq of PREDEFINED_QUESTIONS) predefinedMap[pq.value] = pq.label;
    for (let i = 0; i < secQList.length; i++) {
      const q = secQList[i];
      if (!q.question) continue;
      if (!q.answer) errors[`a${i}`] = t('validation.required');
      else if (q.answer.length < 2) errors[`a${i}`] = t('security.answerTooShort');
      else { const fullQuestion = predefinedMap[q.question] || q.question; const answerHash = await hashAnswer(q.answer.toLowerCase().trim()); validQuestions.push({ question: fullQuestion, answerHash }); }
    }
    if (validQuestions.length === 0 && secQList.some(q => q.question)) errors['general'] = t('security.atLeastOneQuestion');
    setSecQErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSecurityQuestions(validQuestions); setSecQModalOpen(false);
    addToast({ title: t('security.questionsSaved'), variant: 'success' });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /><h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('security.title')}</h2></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('security.pinLock')}</p><p className="text-xs text-gray-400 dark:text-gray-500">{t('security.pinLockDesc')}</p></div>
              {pinHash ? (
                <div className="flex items-center gap-2">
                  <Tooltip content={t('security.changePin')}><Button size="sm" variant="outline" onClick={() => setPinModalMode('change')}><KeyRound className="w-3.5 h-3.5" />{t('security.changePin')}</Button></Tooltip>
                  <Tooltip content={t('security.removePin')}><Button size="sm" variant="outline" className="text-danger border-danger/30 hover:bg-danger-light" onClick={() => setPinModalMode('remove')}><Trash2 className="w-3.5 h-3.5" /></Button></Tooltip>
                </div>
              ) : <Button size="sm" variant="outline" onClick={() => setPinModalMode('set')}><KeyRound className="w-3.5 h-3.5" />{t('security.setPin')}</Button>}
            </div>
            {pinHash && (
              <label className="flex items-center gap-3 cursor-pointer mt-2">
                <div className="relative"><input type="checkbox" className="sr-only peer" checked={lockEnabled} onChange={(e) => setLockEnabled(e.target.checked)} /><div className="w-10 h-6 rounded-full bg-gray-200 dark:bg-gray-600 peer-checked:bg-primary transition-colors duration-200" /><div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm peer-checked:translate-x-4 transition-transform duration-200" /></div>
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{t('security.pinLock')}</span>
              </label>
            )}
          </div>
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700/30">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('security.biometric')}</p><p className="text-xs text-gray-400 dark:text-gray-500">{t('security.biometricDesc')}</p></div>
              {bioAvailable ? (bioRegistered ? (
                <div className="flex items-center gap-2">
                  <Badge variant="info" className="text-xs"><Fingerprint className="w-3 h-3 mr-1" />{t('security.biometricRegistered')}</Badge>
                  <label className="flex items-center gap-3 cursor-pointer"><div className="relative"><input type="checkbox" className="sr-only peer" checked={biometricEnabled} onChange={(e) => { setBiometricEnabled(e.target.checked); if (!e.target.checked) { removeBiometricCredential(); setBioRegistered(false); } }} /><div className="w-10 h-6 rounded-full bg-gray-200 dark:bg-gray-600 peer-checked:bg-primary transition-colors duration-200" /><div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm peer-checked:translate-x-4 transition-transform duration-200" /></div></label>
                </div>
              ) : <Button size="sm" variant="outline" onClick={handleRegisterBiometric}><Fingerprint className="w-3.5 h-3.5" />{t('security.registerBiometric')}</Button>) : <span className="text-xs text-gray-400">{t('security.biometricNotAvailable')}</span>}
            </div>
          </div>
          {pinHash && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700/30">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('security.securityQuestions')}</p><p className="text-xs text-gray-400 dark:text-gray-500">{t('security.securityQuestionsDesc')}</p></div>
                <div className="flex items-center gap-2">
                  {securityQuestions.length > 0 && <Badge variant="info" className="text-xs">{t('security.questionsCount', { count: securityQuestions.length })}</Badge>}
                  <Button size="sm" variant="outline" onClick={openSecQuestions}><Edit3 className="w-3.5 h-3.5" />{securityQuestions.length > 0 ? t('common.edit') : t('security.setupQuestions')}</Button>
                </div>
              </div>
              {securityQuestions.length > 0 && (
                <ul className="mt-2 space-y-1">{securityQuestions.map((q, i) => (<li key={i} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" /><span className="truncate">{q.question}</span></li>))}</ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PIN Modal */}
      <Modal isOpen={pinModalMode !== null} onClose={() => { setPinModalMode(null); setPinForm({ currentPin: '', newPin: '', confirmPin: '' }); setPinFormErrors({}); }} title={pinModalMode === 'set' ? t('security.setPin') : pinModalMode === 'change' ? t('security.changePin') : t('security.removePin')} footer={<><Button variant="ghost" onClick={() => { setPinModalMode(null); setPinForm({ currentPin: '', newPin: '', confirmPin: '' }); setPinFormErrors({}); }}>{t('common.cancel')}</Button><Button onClick={handleSavePin}>{pinModalMode === 'remove' ? t('common.confirm') : t('common.save')}</Button></>}>
        <div className="space-y-4">
          {(pinModalMode === 'change' || pinModalMode === 'remove') && <Input label={t('security.enterCurrentPin')} type="password" inputMode="numeric" maxLength={pinLength} value={pinForm.currentPin} onChange={(e) => { setPinForm(prev => ({ ...prev, currentPin: e.target.value.replace(/\D/g, '').slice(0, pinLength) })); setPinFormErrors({}); }} error={pinFormErrors.currentPin} />}
          {pinModalMode !== 'remove' && (<>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('security.pinLength')}</label><div className="flex gap-2">
              <button type="button" onClick={() => setPinLength(4)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${pinLength === 4 ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>4 {t('security.digits')}</button>
              <button type="button" onClick={() => setPinLength(6)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${pinLength === 6 ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>6 {t('security.digits')}</button>
            </div></div>
            <Input label={t('security.enterNewPin')} type="password" inputMode="numeric" maxLength={pinLength} value={pinForm.newPin} onChange={(e) => { setPinForm(prev => ({ ...prev, newPin: e.target.value.replace(/\D/g, '').slice(0, pinLength) })); setPinFormErrors({}); }} error={pinFormErrors.newPin} />
            <Input label={t('security.confirmPin')} type="password" inputMode="numeric" maxLength={pinLength} value={pinForm.confirmPin} onChange={(e) => { setPinForm(prev => ({ ...prev, confirmPin: e.target.value.replace(/\D/g, '').slice(0, pinLength) })); setPinFormErrors({}); }} error={pinFormErrors.confirmPin} />
          </>)}
          {pinModalMode === 'remove' && <p className="text-sm text-gray-500 dark:text-gray-400">{t('security.pinLockDesc')}</p>}
        </div>
      </Modal>

      {/* Security Questions Modal */}
      <Modal isOpen={secQModalOpen} onClose={() => { setSecQModalOpen(false); setSecQErrors({}); }} title={t('security.securityQuestions')} size="lg" footer={<><Button variant="ghost" onClick={() => { setSecQModalOpen(false); setSecQErrors({}); }}>{t('common.cancel')}</Button><Button onClick={handleSaveSecQuestions}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          {secQErrors.general && <p className="text-sm text-danger">{secQErrors.general}</p>}
          {secQList.map((q, idx) => (
            <div key={idx} className="space-y-3 p-4 rounded-lg border border-gray-100 dark:border-gray-700/30 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('security.questionNumber', { number: idx + 1 })}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('security.selectQuestion')}</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" value={PREDEFINED_QUESTIONS.some(pq => pq.value === q.question) ? q.question : 'custom'} onChange={(e) => { const val = e.target.value; setSecQList(prev => prev.map((item, i) => i === idx ? { ...item, question: val === 'custom' ? '' : val } : item)); setSecQErrors({}); }}>
                  <option value="">{t('common.select')}</option>
                  {PREDEFINED_QUESTIONS.filter(pq => pq.value !== 'custom' || !secQList.some((sq, si) => si !== idx && PREDEFINED_QUESTIONS.find(pq2 => pq2.value === sq.question)?.value === pq.value)).map(pq => <option key={pq.value} value={pq.value}>{pq.label}</option>)}
                  <option value="custom">{t('security.qCustom')}</option>
                </select>
              </div>
              {!PREDEFINED_QUESTIONS.some(pq => pq.value === q.question) && <Input label={t('security.yourQuestion')} value={q.question} onChange={(e) => { setSecQList(prev => prev.map((item, i) => i === idx ? { ...item, question: e.target.value } : item)); setSecQErrors({}); }} placeholder={t('security.yourQuestionPlaceholder')} />}
              <Input label={t('security.yourAnswer')} type="password" value={q.answer} onChange={(e) => { setSecQList(prev => prev.map((item, i) => i === idx ? { ...item, answer: e.target.value } : item)); setSecQErrors({}); }} placeholder={t('security.yourAnswerPlaceholder')} error={secQErrors[`a${idx}`]} />
            </div>
          ))}
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('security.securityQuestionsNote')}</p>
        </div>
      </Modal>
      {ConfirmDialog}
    </>
  );
}
