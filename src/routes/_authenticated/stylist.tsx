import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState, PageHeader } from "@/components/common/States";
import { OutfitCard } from "@/components/outfits/OutfitCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { conversationsQuery, messagesQuery, outfitQuery } from "@/lib/queries";
import { sendStylistMessage } from "@/lib/styling.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/stylist")({
  head: () => ({ meta: [{ title: "Stylist — VÉSTARA" }, { name: "description", content: "Chat with your AI stylist." }, { property: "og:title", content: "Stylist — VÉSTARA" }, { property: "og:description", content: "Chat with your AI stylist." }] }),
  component: Page,
});

const PROMPTS = ["What should I wear to college today?", "Make it smarter", "Swap the shoes", "Dinner date outfit"];

function MessageOutfit({ id }: { id: string }) {
  const o = useQuery(outfitQuery(id));
  return o.data ? <div className="mt-3"><OutfitCard outfit={o.data} compact /></div> : null;
}

function Page() {
  const qc = useQueryClient();
  const send = useServerFn(sendStylistMessage);
  const convs = useQuery(conversationsQuery);
  const [convId, setConvId] = useState<string | null>(null);
  const msgs = useQuery(messagesQuery(convId));
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.data, pending]);

  const m = useMutation({
    mutationFn: (t: string) => send({ data: { conversationId: convId, text: t } }),
    onMutate: (t) => setPending(t),
    onSuccess: (r) => { setConvId(r.conversationId); qc.invalidateQueries({ queryKey: ["messages", r.conversationId] }); qc.invalidateQueries({ queryKey: ["conversations"] }); qc.invalidateQueries({ queryKey: ["outfits"] }); },
    onError: () => toast.error("The stylist couldn't reply. Please try again."),
    onSettled: () => setPending(null),
  });

  function submit(e?: FormEvent, t = text) {
    e?.preventDefault();
    if (!t.trim() || m.isPending) return;
    m.mutate(t.trim());
    setText("");
  }

  return (
    <AppShell>
      <PageHeader eyebrow="Stylist" title="Ask your stylist" body="Plan a look, tweak it, or ask for advice — in your own words." />
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <Button variant="quiet" size="sm" className="mb-2 w-full" onClick={() => setConvId(null)}><Plus /> New chat</Button>
          {convs.data?.map((c) => (
            <button key={c.id} onClick={() => setConvId(c.id)} className={cn("block w-full truncate rounded-lg px-3 py-2 text-left text-sm", convId === c.id ? "bg-secondary" : "text-muted-foreground hover:text-foreground")}>{c.title || "Conversation"}</button>
          ))}
        </aside>
        <section className="flex min-h-[60vh] flex-col rounded-2xl border bg-card">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {!convId && !pending && (
              <div className="py-10 text-center">
                <p className="text-muted-foreground">Try one of these:</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {PROMPTS.map((p) => <Button key={p} size="sm" variant="quiet" onClick={() => submit(undefined, p)}>{p}</Button>)}
                </div>
              </div>
            )}
            {convId && msgs.isLoading && <LoadingState />}
            {msgs.data?.map((msg) => (
              <div key={msg.id} className={cn("max-w-[90%]", msg.role === "user" ? "ml-auto" : "")}>
                <div className={cn("rounded-2xl px-4 py-3 text-sm", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary")}>{msg.content}</div>
                {msg.outfit_id && <MessageOutfit id={msg.outfit_id} />}
              </div>
            ))}
            {pending && <>
              <div className="ml-auto max-w-[90%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground">{pending}</div>
              <div className="w-fit rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">Thinking…</div>
            </>}
            <div ref={end} />
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t p-3">
            <Input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="e.g. Something warmer for tonight" aria-label="Message" />
            <Button type="submit" variant="hero" size="icon" disabled={m.isPending || !text.trim()} aria-label="Send"><Send /></Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
