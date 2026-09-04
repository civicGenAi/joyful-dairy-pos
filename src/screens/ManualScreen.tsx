import { useApp } from "@/app/context";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { exportElementPDF } from "@/lib/export";
import { useRef, useState } from "react";
import { toast } from "sonner";

// The user manual. Deliberately not built from the app's usual cards and
// pills: this is a document, printed and handed to someone on their first
// day, so it follows document conventions rather than screen ones. No
// icons, brand colour used for structure rather than decoration, and every
// feature carries a place for a screenshot of the real thing.
//
// Screenshots live in public/manual and are picked up by file name, so
// they can be replaced without touching this file. A slot with no image
// yet renders a labelled frame naming what to capture, which keeps an
// unfinished manual readable instead of leaving a hole in the page.

const BRAND = "#1E7C3F";
const BRAND_LIGHT = "#8CC63F";

function Shot({ file, caption }: { file: string; caption: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="my-5">
      {failed ? (
        <div
          className="rounded-lg border-2 border-dashed grid place-items-center px-4 py-10 text-center"
          style={{ borderColor: "#C9D6CC", background: "#F7F9F7" }}
        >
          <div className="text-[13px] font-semibold" style={{ color: BRAND }}>
            {caption}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5 font-num">
            public/manual/{file}
          </div>
        </div>
      ) : (
        <img
          src={`/manual/${file}`}
          alt={caption}
          onError={() => setFailed(true)}
          className="w-full rounded-lg border"
          style={{ borderColor: "#DCE5DE" }}
        />
      )}
      <figcaption className="text-[11.5px] text-muted-foreground mt-2 text-center">
        {caption}
      </figcaption>
    </figure>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-11 break-inside-avoid">
      <div
        className="flex items-baseline gap-3 pb-2 mb-4 border-b-2"
        style={{ borderColor: BRAND }}
      >
        <span className="font-num text-sm font-bold" style={{ color: BRAND_LIGHT }}>
          {n}
        </span>
        <h2 className="text-xl font-bold font-display" style={{ color: BRAND }}>
          {title}
        </h2>
      </div>
      <div className="space-y-3.5 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[26px_1fr] gap-3 items-start">
      <span
        className="grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-bold text-white font-num mt-0.5"
        style={{ background: BRAND }}
      >
        {n}
      </span>
      <div>{children}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg px-4 py-3 text-[14px] border-l-4"
      style={{ borderColor: BRAND_LIGHT, background: "#F4F8F2" }}
    >
      {children}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg px-4 py-3 text-[14px] border-l-4"
      style={{ borderColor: "#E11B22", background: "#FDF3F3" }}
    >
      {children}
    </div>
  );
}

export function ManualScreen() {
  const { t, lang } = useApp();
  const docRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const sw = lang === "sw";

  const download = async () => {
    if (!docRef.current) return;
    setSaving(true);
    try {
      await exportElementPDF(docRef.current, "African-Joy-Dairy-User-Manual");
      toast.success(t("Imepakuliwa", "Downloaded"));
    } catch {
      toast.error(t("Imeshindikana kupakua", "Could not build the PDF"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-[820px] px-6 py-3 flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/help">{t("Rudi kwenye Msaada", "Back to Help")}</Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              {t("Chapisha", "Print")}
            </Button>
            <Button
              size="sm"
              onClick={download}
              disabled={saving}
              className="text-white"
              style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_LIGHT})` }}
            >
              {saving ? t("Inaandaa…", "Preparing…") : t("Pakua PDF", "Download PDF")}
            </Button>
          </div>
        </div>
      </div>

      <div ref={docRef} className="mx-auto max-w-[820px] bg-card px-8 sm:px-12 py-12">
        {/* Cover */}
        <div className="text-center pb-10 mb-4 border-b-4" style={{ borderColor: BRAND }}>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-4"
            style={{ color: BRAND_LIGHT }}
          >
            African Joy Dairy
          </div>
          <h1 className="text-4xl font-bold font-display leading-tight" style={{ color: BRAND }}>
            {t("Mwongozo wa Mtumiaji", "User Manual")}
          </h1>
          <p className="text-[15px] text-muted-foreground mt-3 max-w-md mx-auto">
            {t(
              "Jinsi ya kuendesha mfumo wa maziwa, kutoka kwa mfugaji hadi kwenye benki.",
              "How to run the dairy system, from the farmer to the bank.",
            )}
          </p>
          <div className="text-[12px] text-muted-foreground mt-6 font-num">
            {t("Toleo la kwanza", "First edition")} · Arusha, Tanzania
          </div>
        </div>

        {/* Contents */}
        <div className="mb-2">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>
            {t("Yaliyomo", "Contents")}
          </h2>
          <ol className="text-[14px] space-y-1.5">
            {[
              [t("Kabla hujaanza", "Before you start"), "1"],
              [t("Siku ya kawaida", "A normal day"), "2"],
              [t("Kupokea maziwa", "Taking in milk"), "3"],
              [t("Kulipa wafugaji", "Paying farmers"), "4"],
              [t("Mauzo ya kaunta", "Counter sales"), "5"],
              [t("Gari la njia", "The route van"), "6"],
              [t("Wateja na mikopo", "Customers and credit"), "7"],
              [t("Uzalishaji na ghala", "Production and stock"), "8"],
              [t("Kufunga siku", "Closing the day"), "9"],
              [t("Matumizi na amana", "Expenses and deposits"), "10"],
              [t("Vitabu vya hesabu", "The books"), "11"],
              [t("Mishahara", "Payroll"), "12"],
              [t("Ripoti", "Reports"), "13"],
              [t("Ujumbe wa makosa", "What the messages mean"), "14"],
              [t("Maneno", "Words you will see"), "15"],
            ].map(([label, n]) => (
              <li key={n} className="flex justify-between gap-3">
                <span>
                  <span className="font-num text-muted-foreground mr-2">{n}</span>
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <Section n="1" title={t("Kabla hujaanza", "Before you start")}>
          <p>
            {t(
              "Kila mtu ana akaunti yake. Usishirikiane nenosiri na mtu mwingine, kwa sababu kila kitu unachofanya kinaandikwa kwa jina lako, na hiyo ndiyo inayolinda pale kunapokuwa na swali.",
              "Everyone has their own account. Do not share a password, because everything you do is recorded under your name, and that record is what protects you when a question comes up later.",
            )}
          </p>
          <Shot file="01-signin.png" caption={t("Ukurasa wa kuingia", "The sign-in screen")} />
          <p>
            {t(
              "Unachoona kinategemea kazi yako. Dereva haoni mishahara, na muuzaji wa kaunta haoni vitabu vya hesabu. Ukikosa kitu unachohitaji, ni ruhusa, siyo hitilafu: muulize msimamizi.",
              "What you see depends on your job. A driver does not see payroll, and a counter seller does not see the books. If something you need is missing, that is a permission, not a fault: ask your supervisor.",
            )}
          </p>
          <Note>
            {t(
              "Lugha inabadilika mahali popote kwa kubonyeza Kiswahili au English juu kulia. Mfumo mzima unabadilika, siyo ukurasa mmoja.",
              "The language switches anywhere from the top right. The whole system changes, not just the page you are on.",
            )}
          </Note>
          <p>
            {t(
              "Kitufe cha Shortcut kwenye upande wa kushoto kinafungua orodha ya skrini zote unazoruhusiwa, zikiwa zimepangwa kwa makundi. Ni njia ya haraka kuliko kutafuta kwenye orodha ndefu.",
              "The Shortcut button in the sidebar opens every screen you are allowed to reach, grouped by area. It is faster than hunting down a long list.",
            )}
          </p>
          <Shot file="03-shortcut.png" caption={t("Orodha ya Shortcut", "The Shortcut panel")} />
        </Section>

        <Section n="2" title={t("Siku ya kawaida", "A normal day")}>
          <p>
            {t(
              "Siku inakwenda kwa mpangilio ule ule kila siku. Ukiujua, kila kitu kingine kinakuwa rahisi.",
              "A day runs in the same order every time. Once you know it, everything else follows.",
            )}
          </p>
          <div className="space-y-2.5">
            <Step n={1}>
              {t(
                "Asubuhi mapema: hesabu ghala kabla shughuli hazijaanza.",
                "Early morning: count the store before any work begins.",
              )}
            </Step>
            <Step n={2}>
              {t(
                "Pokea maziwa kutoka kwa wafugaji, kikao cha asubuhi.",
                "Take in milk from the farmers, the morning session.",
              )}
            </Step>
            <Step n={3}>
              {t(
                "Pakia gari, kisha uza njiani. Kaunta inauza siku nzima.",
                "Load the van, then sell on the route. The counter sells all day.",
              )}
            </Step>
            <Step n={4}>
              {t("Tengeneza bidhaa kutoka maziwa ghafi.", "Make product from the raw milk.")}
            </Step>
            <Step n={5}>{t("Pokea maziwa ya jioni.", "Take in the evening milk.")}</Step>
            <Step n={6}>
              {t(
                "Gari linarudi: hesabu marejesho, kisha weka cash benki.",
                "The van returns: count the returns, then bank the cash.",
              )}
            </Step>
            <Step n={7}>
              {t(
                "Funga siku. Hii ndiyo hatua inayothibitisha kila kitu kimelingana.",
                "Close the day. This is the step that proves everything adds up.",
              )}
            </Step>
          </div>
          <Shot
            file="02-dashboard.png"
            caption={t("Dashibodi asubuhi", "The dashboard in the morning")}
          />
        </Section>

        <Section n="3" title={t("Kupokea maziwa", "Taking in milk")}>
          <p>
            {t(
              "Nenda Wafugaji, kisha Rekodi ukusanyaji. Weka lita za asubuhi na za jioni kwenye fomu moja. Huna haja ya kurudi mara mbili.",
              "Go to Farmers, then Record collection. Enter the morning and evening litres on one form. You do not need to come back twice.",
            )}
          </p>
          <Shot
            file="05-collection.png"
            caption={t("Kurekodi ukusanyaji", "Recording a collection")}
          />
          <p>
            {t(
              "Bei inayotumika ni ile ya mfugaji siku hiyo, na inahifadhiwa pamoja na rekodi. Bei ikibadilika baadaye, rekodi za zamani hazibadiliki.",
              "The rate used is the farmer's rate on that day, and it is stored with the record. If the rate changes later, old records do not move.",
            )}
          </p>

          <h3 className="text-[15px] font-bold pt-2">
            {t("Maziwa yaliyokataliwa", "When you refuse milk")}
          </h3>
          <p>
            {t(
              "Kama maziwa yamefeli kipimo, usipunguze tu lita. Bonyeza Kuna maziwa yaliyokataliwa, weka kiasi kilichorudishwa na sababu. Mfugaji atalipwa kwa aliyokubaliwa tu, lakini rekodi itaonyesha aliyoleta.",
              "If milk fails a test, do not simply enter fewer litres. Use Was any milk refused, enter the amount sent back and the reason. She is paid only for what was accepted, but the record shows what she brought.",
            )}
          </p>
          <Shot
            file="06-collection-reject.png"
            caption={t("Kurekodi yaliyokataliwa", "Recording refused milk")}
          />
          <Note>
            {t(
              "Hii ndiyo inayokuwezesha kujua ni wafugaji gani wanakataliwa mara kwa mara na kwa sababu gani. Bila hivyo, maziwa yaliyokataliwa na yasiyoletwa yanaonekana sawa.",
              "This is what lets you see which farmers are being refused, how often, and why. Without it, milk refused and milk never brought look the same.",
            )}
          </Note>
          <Warn>
            {t(
              "Huwezi kurekodi tarehe ijayo, na huwezi kurekodi siku iliyofungwa. Ukikosea, fungua siku ile ile na urekebishe: mfumo unarekebisha, hauongezi mara mbili.",
              "You cannot record a future date, and you cannot record into a day that is already locked. If you make a mistake, open the same day and correct it: the system corrects rather than adding a second time.",
            )}
          </Warn>
        </Section>

        <Section n="4" title={t("Kulipa wafugaji", "Paying farmers")}>
          <p>
            {t(
              "Kila mfugaji ana salio linalokua kila unapopokea maziwa yake. Bonyeza jina lake kuona kalenda ya mwezi, lita za kila siku, na kiasi anachodai.",
              "Every farmer has a balance that grows each time you take in her milk. Click her name to see the month calendar, the litres each day, and what she is owed.",
            )}
          </p>
          <Shot file="04-farmers.png" caption={t("Orodha ya wafugaji", "The farmer list")} />
          <p>
            {t(
              "Kulipa mmoja mmoja, tumia Lipa. Kulipa wote mwisho wa mzunguko, tumia Anzisha malipo kwenye Fedha.",
              "To pay one farmer, use Pay. To pay everyone at the end of the cycle, use Initiate payouts under Finance.",
            )}
          </p>
          <Shot file="07-farmer-pay.png" caption={t("Kulipa mfugaji", "Paying a farmer")} />
          <Warn>
            {t(
              "Huwezi kulipa zaidi ya anachodai. Mfumo utakataa, na hiyo ni kinga siyo kikwazo.",
              "You cannot pay more than a farmer is owed. The system refuses, and that is a protection rather than an obstacle.",
            )}
          </Warn>
          <p>
            {t(
              "Risiti ya M-Pesa au benki ni ya hiari. Unaweza kuhifadhi malipo sasa na kupakia picha ya risiti baadaye ikifika.",
              "A M-Pesa or bank receipt is optional. You can save the payment now and attach the photo later when it arrives.",
            )}
          </p>
        </Section>

        <Section n="5" title={t("Mauzo ya kaunta", "Counter sales")}>
          <p>
            {t(
              "Chagua mteja au acha Bila jina, gusa bidhaa, chagua namna ya kulipa, kisha maliza. Risiti inatengenezwa yenyewe.",
              "Pick the customer or leave it as Walk-in, tap the products, choose how they are paying, then finish. The receipt is generated for you.",
            )}
          </p>
          <Shot file="08-pos.png" caption={t("Mauzo ya kaunta", "The counter")} />
          <Warn>
            {t(
              "Huwezi kuuza zaidi ya kilichopo ghalani. Ukijaribu, mfumo utakuambia kiasi kilichopo. Hii inazuia ghala kwenda hasi, ambalo huharibu hesabu za siku nzima.",
              "You cannot sell more than is in stock. If you try, the system tells you how much there is. This stops stock going negative, which would spoil the whole day's figures.",
            )}
          </Warn>
        </Section>

        <Section n="6" title={t("Gari la njia", "The route van")}>
          <p>
            {t(
              "Njia ina hatua tano, na zinafuatana. Ukikwama, angalia hatua iliyotangulia.",
              "The route has five steps and they run in order. If you are stuck, look at the step before.",
            )}
          </p>
          <div className="space-y-2.5">
            <Step n={1}>
              <strong>{t("Ratiba", "Plan")}</strong>
              {": "}
              {t(
                "wateja wa leo kwa mpangilio. Bonyeza Uza kwenda moja kwa moja.",
                "today's customers in order. Tap Sell to go straight there.",
              )}
            </Step>
            <Step n={2}>
              <strong>{t("Pakia", "Load")}</strong>
              {": "}
              {t(
                "weka ulichonacho, kisha thibitisha. Huwezi kuuza kabla ya kuthibitisha.",
                "enter what you have, then confirm. You cannot sell before confirming.",
              )}
            </Step>
            <Step n={3}>
              <strong>{t("Uza", "Sell")}</strong>
              {": "}
              {t(
                "kila kituo: mteja, bidhaa, malipo.",
                "at each stop: the customer, the products, the payment.",
              )}
            </Step>
            <Step n={4}>
              <strong>{t("Marejesho", "Returns")}</strong>
              {": "}
              {t(
                "kilichobaki kinahesabiwa chenyewe na kinarudi ghalani.",
                "what is left is worked out for you and goes back to store.",
              )}
            </Step>
            <Step n={5}>
              <strong>{t("Fungasa", "Cash-up")}</strong>
              {": "}
              {t("weka cash benki, kisha rekodi amana.", "bank the cash, then record the deposit.")}
            </Step>
          </div>
          <Shot file="09-route-load.png" caption={t("Kupakia gari", "Loading the van")} />
          <Shot file="10-route-sell.png" caption={t("Kuuza njiani", "Selling on the route")} />
          <Note>
            {t(
              "Huwezi kuuza zaidi ya kilichopakiwa. Hii ndiyo inayofanya marejesho yawe na maana mwisho wa njia.",
              "You cannot sell more than was loaded. That is what makes the returns figure mean something at the end of the round.",
            )}
          </Note>
          <Shot
            file="11-route-cashup.png"
            caption={t("Kufunga fedha za njia", "The route cash-up")}
          />
          <Warn>
            {t(
              "Mauzo ya mkopo hayahesabiwi kwenye cash ya kufungasa. Ni deni la mteja, atalipa baadaye. Hapa ndipo watu wengi wanachanganyikiwa.",
              "Credit sales are not part of the cash you bank. They stay as the customer's debt to be paid later. This is where most confusion comes from.",
            )}
          </Warn>
        </Section>

        <Section n="7" title={t("Wateja na mikopo", "Customers and credit")}>
          <p>
            {t(
              "Wateja ni wa aina tatu: wanaolipa papo hapo, wanaokopa kila mauzo, na wanaochukua mwezi mzima kisha kulipa.",
              "There are three kinds of customer: those who pay on the spot, those who take each sale on credit, and those who draw all month and settle at the end.",
            )}
          </p>
          <Shot file="12-customers.png" caption={t("Orodha ya wateja", "The customer list")} />
          <p>
            {t(
              "Unaweza kuweka kikomo cha mkopo kwa kila mteja. Mauzo ya mkopo yatakataliwa yakizidi kikomo hicho. Ukiacha wazi, hakuna kikomo.",
              "You can set a credit limit for each customer. A credit sale is refused once their balance would pass it. Leave it blank and there is no limit.",
            )}
          </p>
          <Shot
            file="13-customer-credit.png"
            caption={t("Kikomo cha mkopo", "Setting a credit limit")}
          />
          <Note>
            {t(
              "Kikomo kinafanya hatari iwe uamuzi wako, siyo jambo unalogundua baadaye deni likishakua.",
              "A limit makes your exposure a decision you made, rather than something you discover after the debt has grown.",
            )}
          </Note>
        </Section>

        <Section n="8" title={t("Uzalishaji na ghala", "Production and stock")}>
          <p>
            {t(
              "Uzalishaji unachukua maziwa ghafi na kutoa bidhaa. Weka lita zilizoingia na kiasi kilichotoka; mfumo unahesabu yield.",
              "Production takes raw milk and gives product. Enter the litres in and the quantity out, and the system works out the yield.",
            )}
          </p>
          <Shot file="14-production.png" caption={t("Kurekodi batch", "Recording a batch")} />
          <p>
            {t(
              "Ghala linaonyesha kilichopo na thamani yake kwa gharama ya wastani. Thamani hii ndiyo inayoingia kwenye mizania mwisho wa mwezi.",
              "Stock shows what you hold and what it is worth at average cost. That value is what goes onto the balance sheet at month end.",
            )}
          </p>
          <Shot file="15-stock.png" caption={t("Ghala na thamani yake", "Stock and its value")} />
          <p>
            {t(
              "Hesabu ya asubuhi inashika tofauti mapema. Ni afadhali kugundua upungufu saa moja asubuhi kuliko saa mbili usiku wakati wa kufunga siku.",
              "The morning count catches a difference early. It is far better to find a shortfall at seven in the morning than at eight at night when you are trying to close the day.",
            )}
          </p>
          <Shot file="16-morning-count.png" caption={t("Hesabu ya asubuhi", "The morning count")} />
        </Section>

        <Section n="9" title={t("Kufunga siku", "Closing the day")}>
          <p>
            {t(
              "Hii ndiyo hatua muhimu kuliko zote. Mfumo unalinganisha kilichoingia na kilichotoka: maziwa yaliyopokelewa pamoja na yaliyotengenezwa lazima yalingane na yaliyouzwa, yaliyoharibika, na yaliyobaki.",
              "This is the most important step of the day. The system compares what came in against what went out: milk taken in plus milk produced must equal what was sold, spoilt, and left over.",
            )}
          </p>
          <Shot file="17-day-close.png" caption={t("Ulinganisho wa siku", "Day reconciliation")} />
          <Warn>
            {t(
              "Siku isipolingana, haitafungwa. Mfumo utakuambia bidhaa gani na tofauti ni kiasi gani. Hii siyo kero: siku ikifungwa ikiwa haijalingana, hesabu za mwezi mzima zinakuwa na shaka.",
              "A day that does not add up will not lock. The system names the product and the difference. This is not an obstacle: a day locked while it still does not add up puts the whole month in doubt.",
            )}
          </Warn>
          <p>
            {t(
              "Siku zisizofungwa zinaendelea kuulizwa kila siku, na baada ya wiki moja zinakuwa za dharura. Zisiachwe.",
              "Days left unlocked keep being raised each day, and after a week they become urgent. Do not leave them.",
            )}
          </p>
        </Section>

        <Section n="10" title={t("Matumizi na amana", "Expenses and deposits")}>
          <p>
            {t(
              "Kila matumizi yana mahali: Kiwanda, Madam, au Shamba. Hii inakuwezesha kuona gharama za kila sehemu peke yake pamoja na jumla kuu.",
              "Every expense belongs to a place: Kiwanda, Madam, or Shamba. That lets you see each part of the business on its own as well as the grand total.",
            )}
          </p>
          <Shot file="18-expenses.png" caption={t("Matumizi kwa mahali", "Expenses by place")} />
          <Note>
            {t(
              "Matumizi ya Madam ni ya mmiliki, siyo gharama ya biashara. Hayapunguzi faida; yanapunguza mtaji kwenye mizania. Hii ndiyo njia sahihi ya kihasibu.",
              "Madam's spending is the owner's own, not a business cost. It does not reduce profit; it reduces equity on the balance sheet. That is the correct accounting treatment.",
            )}
          </Note>
          <p>
            {t(
              "Amana za mauzo zinarekodi fedha zinazopelekwa benki au M-Pesa, kwa kila aina ya bidhaa au sehemu, kwa mwezi.",
              "Sales deposits record money banked or sent by M-Pesa, per product line or outlet, month by month.",
            )}
          </p>
          <Shot file="19-sales-deposits.png" caption={t("Amana za mauzo", "Sales deposits")} />
        </Section>

        <Section n="11" title={t("Vitabu vya hesabu", "The books")}>
          <p>
            {t(
              "Vitabu vinajaza vyenyewe kila usiku kutokana na kila kitu kilichorekodiwa mchana. Huna haja ya kuandika chochote mara mbili.",
              "The books fill themselves each night from everything recorded during the day. You never enter anything twice.",
            )}
          </p>
          <Shot file="20-books-pl.png" caption={t("Faida na hasara", "Profit and loss")} />
          <p>
            {t(
              "Faida na hasara inaonyesha mapato, gharama ya maziwa, na matumizi. Mizania inaonyesha unachomiliki na unachodaiwa. Zote mbili zinatoka mahali pamoja, hivyo haziwezi kutofautiana.",
              "Profit and loss shows revenue, the cost of milk, and expenses. The balance sheet shows what you own and what you owe. Both come from the same place, so they cannot disagree.",
            )}
          </p>
          <Shot file="21-books-balance.png" caption={t("Mizania", "The balance sheet")} />
          <p>
            {t(
              "VAT inaonyesha kodi ya mauzo, kodi ya manunuzi, na kiasi cha kulipa TRA.",
              "The VAT page shows tax charged, tax reclaimable, and what is payable to TRA.",
            )}
          </p>
          <Shot file="22-books-vat.png" caption={t("VAT", "The VAT return")} />

          <h3 className="text-[15px] font-bold pt-2">
            {t("Kulinganisha na benki", "Reconciling with the bank")}
          </h3>
          <p>
            {t(
              "Fedha huingia benki kwa kuchelewa, na risiti hufika baadaye zaidi. Kwa hiyo kulinganisha kunafanya kazi pande zote mbili.",
              "Money reaches the bank late, and receipts arrive later still. So reconciling works in both directions.",
            )}
          </p>
          <div className="space-y-2.5">
            <Step n={1}>
              {t(
                "Weka tiki kwenye kila kipengele kinachoonekana kwenye taarifa ya benki.",
                "Tick every item that appears on the bank statement.",
              )}
            </Step>
            <Step n={2}>
              {t(
                "Kama taarifa ina kitu ambacho hakikuingizwa hapa, kama gharama za benki au mteja aliyelipa moja kwa moja, tumia Ongeza kutoka taarifa.",
                "If the statement carries something never entered here, such as a bank charge or a customer who paid directly, use Add from statement.",
              )}
            </Step>
            <Step n={3}>
              {t(
                "Weka salio la mwisho la taarifa. Tofauti ikiwa sifuri, umemaliza.",
                "Enter the statement closing balance. If the difference is zero, you are done.",
              )}
            </Step>
          </div>
          <Shot file="23-books-bank.png" caption={t("Kulinganisha benki", "Bank reconciliation")} />
          <Note>
            {t(
              "Amana uliyorekodi ambayo benki bado haijaiona inabaki bila tiki, na hiyo ni sahihi. Ni fedha iliyo njiani.",
              "A deposit you recorded that the bank has not seen yet stays unticked, and that is correct. It is money in transit.",
            )}
          </Note>
        </Section>

        <Section n="12" title={t("Mishahara", "Payroll")}>
          <p>
            {t(
              "Weka wafanyakazi na mshahara ghafi wa kila mmoja. Kila mwezi bonyeza Andaa mishahara: mfumo unahesabu NSSF, PAYE, na kiasi halisi cha kulipwa.",
              "Add your employees with each one's gross salary. Each month use Prepare payroll: the system works out NSSF, PAYE, and what each person actually takes home.",
            )}
          </p>
          <Shot file="24-payroll.png" caption={t("Mishahara ya mwezi", "The month's payroll")} />
          <p>
            {t(
              "Baada ya kuweka vitabuni, kodi na NSSF zinabaki zikidaiwa mpaka uzilipe. Ni fedha unayoshikilia kwa niaba ya wengine, siyo yako.",
              "Once posted, the tax and NSSF stay owed until you remit them. That is money you are holding on someone else's behalf, not yours.",
            )}
          </p>
          <Warn>
            {t(
              "Viwango vya kodi vinabadilika kila bajeti. Vihakiki na TRA na NSSF kabla ya kumpa mtu risiti ya mshahara.",
              "Tax rates change with each budget. Check them against TRA and NSSF guidance before handing anyone a payslip.",
            )}
          </Warn>
        </Section>

        <Section n="13" title={t("Ripoti", "Reports")}>
          <p>
            {t(
              "Ripoti zinaonyesha mwenendo: maziwa kwa siku, mauzo kwa aina, wateja wakubwa, na yield ya uzalishaji. Kila jedwali linaweza kupakuliwa kama Excel, CSV, au PDF.",
              "Reports show the trend: milk by day, sales by category, your largest customers, and production yield. Every table can be downloaded as Excel, CSV, or PDF.",
            )}
          </p>
          <Shot file="25-reports.png" caption={t("Ripoti", "Reports")} />
        </Section>

        <Section n="14" title={t("Ujumbe wa makosa", "What the messages mean")}>
          <p>
            {t(
              "Ujumbe huu unaonekana pale mfumo unapozuia kitu. Kila mmoja una maana na njia ya kutatua.",
              "These appear when the system stops something. Each one has a meaning and a way forward.",
            )}
          </p>
          <div className="mt-3 border-t" style={{ borderColor: "#DCE5DE" }}>
            {[
              [
                t("Siku hii imefungwa", "This day is locked"),
                t(
                  "Siku ilishathibitishwa. Muulize msimamizi wa uzalishaji kama kweli inahitaji kufunguliwa.",
                  "The day was already confirmed. Ask the production manager whether it truly needs reopening.",
                ),
              ],
              [
                t("Hakuna bidhaa za kutosha", "Not enough stock"),
                t(
                  "Unauza zaidi ya kilichopo. Hesabu ghala tena; huenda kuna kitu hakikurekodiwa.",
                  "You are selling more than you hold. Recount the store; something may not have been recorded.",
                ),
              ],
              [
                t("Umezidi kilichopakiwa", "More than was loaded"),
                t(
                  "Gari halina kiasi hicho. Angalia tabo ya Pakia.",
                  "The van does not have that much. Check the Load tab.",
                ),
              ],
              [
                t("Mteja amefikia kikomo", "Customer reached their limit"),
                t(
                  "Anahitaji kulipa kwanza, au msimamizi aongeze kikomo.",
                  "They need to pay something first, or a supervisor must raise the limit.",
                ),
              ],
              [
                t("Huwezi kulipa zaidi ya deni", "Cannot pay more than is owed"),
                t(
                  "Kiasi ni kikubwa kuliko salio la mfugaji. Angalia salio lake.",
                  "The amount is larger than the farmer's balance. Check what she is owed.",
                ),
              ],
              [
                t("Siku hailingani", "The day does not balance"),
                t(
                  "Kilichoingia na kilichotoka havilingani. Ujumbe unataja bidhaa na tofauti.",
                  "What came in and what went out do not match. The message names the product and the difference.",
                ),
              ],
              [
                t("Kipindi kimefungwa", "That period is locked"),
                t(
                  "Mwezi ule tayari umewasilishwa. Marekebisho yataenda mwezi unaofuata ulio wazi.",
                  "That month has already been filed. A correction goes into the next open month instead.",
                ),
              ],
            ].map(([msg, meaning]) => (
              <div
                key={msg}
                className="grid sm:grid-cols-[210px_1fr] gap-x-4 gap-y-1 py-3 border-b"
                style={{ borderColor: "#DCE5DE" }}
              >
                <div className="font-semibold text-[14px]">{msg}</div>
                <div className="text-[14px] text-muted-foreground">{meaning}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section n="15" title={t("Maneno", "Words you will see")}>
          <div className="grid sm:grid-cols-2 gap-x-8">
            {[
              [
                sw ? "Mzunguko" : "Cycle",
                sw ? "Kipindi cha malipo ya wafugaji" : "The farmer payment period",
              ],
              [
                sw ? "Yield" : "Yield",
                sw
                  ? "Kiasi kilichopatikana kutoka maziwa ghafi"
                  : "How much product came from the raw milk",
              ],
              [
                sw ? "Salio" : "Balance",
                sw ? "Kinachodaiwa au kinachomilikiwa" : "What is owed, or what is held",
              ],
              [
                sw ? "Amana" : "Deposit",
                sw ? "Fedha iliyopelekwa benki" : "Money placed in the bank",
              ],
              [
                sw ? "Mkopo" : "Credit",
                sw ? "Mauzo yatakayolipwa baadaye" : "A sale to be paid for later",
              ],
              [
                sw ? "Marejesho" : "Returns",
                sw ? "Kilichobaki baada ya njia" : "What came back after the route",
              ],
              [
                sw ? "Uchakavu" : "Depreciation",
                sw ? "Kupungua kwa thamani ya kifaa" : "The value equipment loses over time",
              ],
              [
                sw ? "Mizania" : "Balance sheet",
                sw ? "Unachomiliki na unachodaiwa" : "What you own and what you owe",
              ],
              [sw ? "VAT" : "VAT", sw ? "Kodi ya ongezeko la thamani" : "Value added tax"],
              [sw ? "PAYE" : "PAYE", sw ? "Kodi ya mshahara" : "Tax on wages"],
            ].map(([word, meaning]) => (
              <div key={word} className="py-2 border-b" style={{ borderColor: "#EAF0EB" }}>
                <span className="font-semibold text-[14px]">{word}</span>
                <span className="text-[13.5px] text-muted-foreground">
                  {": "}
                  {meaning}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <div
          className="mt-14 pt-5 text-center text-[12px] text-muted-foreground border-t-2"
          style={{ borderColor: BRAND }}
        >
          {t(
            "African Joy Dairy, Arusha. Mwongozo huu unapatikana ndani ya mfumo chini ya Msaada.",
            "African Joy Dairy, Arusha. This manual lives inside the system under Help.",
          )}
        </div>
      </div>
    </div>
  );
}
