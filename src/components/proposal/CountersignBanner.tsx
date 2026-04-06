import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, PenTool } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  proposalId: string;
  clientName: string | null;
  onSigned: () => void;
}

export default function CountersignBanner({ proposalId, clientName, onSigned }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a1a1a';

    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      if ('touches' in e) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
      return { x: (e as MouseEvent).clientX - r.left, y: (e as MouseEvent).clientY - r.top };
    };

    const start = (e: MouseEvent | TouchEvent) => { e.preventDefault(); isDrawing.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const draw = (e: MouseEvent | TouchEvent) => { if (!isDrawing.current) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSignature(true); };
    const end = () => { isDrawing.current = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', end);
    };
  }, [open]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSign = async () => {
    if (!canvasRef.current) return;
    setSigning(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      // Get current user for folder scoping
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'unknown';
      const fileName = `${userId}/contractor-${proposalId}-${Date.now()}.png`;
      const { error: uploadErr } = await supabase.storage
        .from('signatures')
        .upload(fileName, blob, { contentType: 'image/png' });
      if (uploadErr) throw uploadErr;

      const { data: urlData, error: urlErr } = await supabase.storage
        .from('signatures')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10); // 10 year signed URL
      if (urlErr) throw urlErr;

      const { error: updateErr } = await supabase
        .from('proposals')
        .update({
          contractor_signature_url: urlData.signedUrl,
          contractor_signed_at: new Date().toISOString(),
        })
        .eq('id', proposalId);
      if (updateErr) throw updateErr;

      // Send countersigned copy to client
      try {
        await supabase.functions.invoke('send-proposal-email', {
          body: { proposal_id: proposalId, send_countersigned: true },
        });
      } catch (emailErr) {
        console.error('[CountersignBanner] Failed to send countersigned email:', emailErr);
      }

      toast({ title: 'Countersigned!', description: 'Your signature has been added and a copy sent to the client.' });
      onSigned();
    } catch (err: any) {
      toast({ title: 'Signing failed', description: err.message, variant: 'destructive' });
    } finally {
      setSigning(false);
    }
  };

  if (!open) {
    return (
      <div className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 space-y-2">
        <div className="flex items-start gap-3">
          <PenTool className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Client Signed — Countersign Required</h3>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              {clientName || 'Your client'} has signed this proposal. Add your countersignature to finalize.
            </p>
          </div>
        </div>
        <Button size="sm" className="w-full gap-2" onClick={() => setOpen(true)}>
          <PenTool className="h-4 w-4" /> Countersign Now
        </Button>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <PenTool className="h-4 w-4" /> Contractor Countersignature
      </h3>
      <div className="border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height: '120px' }}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Draw your signature above</p>
        <Button variant="ghost" size="sm" onClick={clearSignature} className="text-xs">Clear</Button>
      </div>
      <Button
        className="w-full gap-2"
        disabled={!hasSignature || signing}
        onClick={handleSign}
      >
        {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        {signing ? 'Submitting...' : 'Submit Countersignature'}
      </Button>
    </div>
  );
}
