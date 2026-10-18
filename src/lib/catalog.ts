/**
 * Curated in-app catalog for instant search-box suggestions (typeahead).
 *
 * Design decision: the dropdown filters this static catalog **client-side** —
 * instant, zero network, zero AI cost — while the actual comparison runs the
 * full live AI pipeline (unknown brands are still resolved by the AI).
 * "Search anyway" always lets the user run their raw query.
 *
 * Medicines are well-known Indian brands with their common active salts;
 * hints are informational — the live pipeline always re-resolves the salt.
 */

export type CatalogKind = "medicine" | "lab";
export type CatalogItem = { name: string; hint: string; kind: CatalogKind };

const MEDICINES: [string, string][] = [
  // Fever / pain
  ["Dolo 650", "Paracetamol 650 mg"],
  ["Calpol 650", "Paracetamol 650 mg"],
  ["Crocin Advance 500", "Paracetamol 500 mg"],
  ["Sumo 650", "Paracetamol 650 mg"],
  ["Combiflam", "Ibuprofen 400 mg + Paracetamol 325 mg"],
  ["Zerodol SP", "Aceclofenac 100 mg + Paracetamol 325 mg + Serratiopeptidase 15 mg"],
  ["Zerodol P", "Aceclofenac 100 mg + Paracetamol 325 mg"],
  ["Hifenac P", "Aceclofenac 100 mg + Paracetamol 325 mg"],
  ["Voveran 50", "Diclofenac 50 mg"],
  ["Ultracet", "Tramadol 37.5 mg + Paracetamol 325 mg"],
  ["Nise 100", "Nimesulide 100 mg"],
  ["Meftal Spas", "Mefenamic acid 250 mg + Dicyclomine 10 mg"],
  ["Saridon", "Paracetamol + Propyphenazone + Caffeine"],
  ["Ecosprin 75", "Aspirin 75 mg"],
  ["Cyclopam", "Dicyclomine 20 mg + Paracetamol 500 mg"],
  // Antibiotics
  ["Augmentin 625 Duo", "Amoxicillin 500 mg + Clavulanic acid 125 mg"],
  ["Augmentin 375", "Amoxicillin 250 mg + Clavulanic acid 125 mg"],
  ["Clavam 625", "Amoxicillin 500 mg + Clavulanic acid 125 mg"],
  ["Mox 500", "Amoxicillin 500 mg"],
  ["Azithral 500", "Azithromycin 500 mg"],
  ["Azee 500", "Azithromycin 500 mg"],
  ["Zithrox 500", "Azithromycin 500 mg"],
  ["Taxim-O 200", "Cefixime 200 mg"],
  ["Zifi 200", "Cefixime 200 mg"],
  ["Monocef-O 200", "Cefpodoxime 200 mg"],
  ["Mahacef 200", "Cefixime 200 mg"],
  ["Cefolac 200", "Cefpodoxime 200 mg"],
  ["Cifran 500", "Ciprofloxacin 500 mg"],
  ["Cifran OD 1000", "Ciprofloxacin 1000 mg (ER)"],
  ["Oflox 200", "Ofloxacin 200 mg"],
  ["Zanocin 200", "Ofloxacin 200 mg"],
  ["Levoflox 500", "Levofloxacin 500 mg"],
  ["Levomac 500", "Levofloxacin 500 mg"],
  ["Metrogyl 400", "Metronidazole 400 mg"],
  ["Flagyl 400", "Metronidazole 400 mg"],
  ["Doxy 1 L Dr", "Doxycycline 100 mg + Lactobacillus"],
  ["Septran DS", "Sulfamethoxazole 800 mg + Trimethoprim 160 mg"],
  ["Norflox 400", "Norfloxacin 400 mg"],
  // Gastro
  ["Pan 40", "Pantoprazole 40 mg"],
  ["Pan-D", "Pantoprazole 40 mg + Domperidone 30 mg (SR)"],
  ["Pantocid 40", "Pantoprazole 40 mg"],
  ["Pantop 40", "Pantoprazole 40 mg"],
  ["Omez 20", "Omeprazole 20 mg"],
  ["Omez-D", "Omeprazole 20 mg + Domperidone 10 mg"],
  ["Rantac 150", "Ranitidine 150 mg"],
  ["Aciloc 300", "Ranitidine 300 mg"],
  ["Nexpro 40", "Esomeprazole 40 mg"],
  ["Esofag 40", "Esomeprazole 40 mg"],
  ["Razo 20", "Rabeprazole 20 mg"],
  ["Cyra-D", "Rabeprazole 20 mg + Domperidone 10 mg"],
  ["Veloz 20", "Rabeprazole 20 mg"],
  ["Ganaton 50", "Itopride 50 mg"],
  ["Domstal 10", "Domperidone 10 mg"],
  ["Perinorm", "Metoclopramide 10 mg"],
  ["Ondem 4", "Ondansetron 4 mg"],
  ["Emeset 4", "Ondansetron 4 mg"],
  ["Vomikind MD 4", "Ondansetron 4 mg"],
  ["Sucrafil O", "Sucralfate 1 g + Oxetacaine"],
  ["Cremaffin", "Liquid paraffin + Milk of magnesia"],
  ["Duphalac", "Lactulose 10 g/15 ml"],
  ["Looz", "Lactulose"],
  ["Dulcolax 5", "Bisacodyl 5 mg"],
  ["Digene Gel", "Antacid gel (Mg + Al hydroxide)"],
  ["Gelusil MPS", "Antacid (Mg + Al + Simethicone)"],
  ["Econorm", "Saccharomyces boulardii"],
  ["Vizylac", "Probiotic (Lactobacillus)"],
  ["Enterogermina", "Bacillus clausii"],
  // Diabetes
  ["Glycomet 500", "Metformin 500 mg"],
  ["Glycomet 850", "Metformin 850 mg"],
  ["Glycomet SR 500", "Metformin SR 500 mg"],
  ["Glycomet GP 1", "Metformin 500 mg + Glimepiride 1 mg"],
  ["Glimepiride 2 mg", "Glimepiride 2 mg"],
  ["Glimestar 2", "Glimepiride 2 mg"],
  ["Amaryl 2", "Glimepiride 2 mg"],
  ["Gluconorm G2", "Metformin 500 mg + Glimepiride 2 mg"],
  ["Januvia 100", "Sitagliptin 100 mg"],
  ["Istavel 100", "Sitagliptin 100 mg"],
  ["Galvus 50", "Vildagliptin 50 mg"],
  ["Jalra 50", "Vildagliptin 50 mg"],
  ["Janumet 50/1000", "Sitagliptin 50 mg + Metformin 1000 mg"],
  ["Trajenta 5", "Linagliptin 5 mg"],
  ["Volibo 0.2", "Voglibose 0.2 mg"],
  ["Lantus", "Insulin glargine 100 IU/ml"],
  ["Human Mixtard 30/70", "Insulin human 30/70"],
  ["NovoRapid", "Insulin aspart 100 IU/ml"],
  ["Ryzodeg 70/30", "Insulin degludec + Insulin aspart"],
  // Cardiac / blood pressure
  ["Telma 40", "Telmisartan 40 mg"],
  ["Telma 80", "Telmisartan 80 mg"],
  ["Telma H", "Telmisartan 40 mg + Hydrochlorothiazide 12.5 mg"],
  ["Telma AM 40", "Telmisartan 40 mg + Amlodipine 5 mg"],
  ["Telsartan 40", "Telmisartan 40 mg"],
  ["Telmikind 40", "Telmisartan 40 mg"],
  ["Amlopres 5", "Amlodipine 5 mg"],
  ["Amlopres AT", "Amlodipine 5 mg + Atenolol 50 mg"],
  ["Stamlo 5", "Amlodipine 5 mg"],
  ["Cilacar 10", "Cilnidipine 10 mg"],
  ["Cilacar 20", "Cilnidipine 20 mg"],
  ["Metolar XR 50", "Metoprolol ER 50 mg"],
  ["Betaloc 50", "Metoprolol 50 mg"],
  ["Nebicard 5", "Nebivolol 5 mg"],
  ["Nebilet 5", "Nebivolol 5 mg"],
  ["Olmezest 20", "Olmesartan 20 mg"],
  ["Repace 40", "Losartan 40 mg"],
  ["Losar 50", "Losartan 50 mg"],
  ["Rosuvas 10", "Rosuvastatin 10 mg"],
  ["Rosuvas 20", "Rosuvastatin 20 mg"],
  ["Rozavel 10", "Rosuvastatin 10 mg"],
  ["Atorva 10", "Atorvastatin 10 mg"],
  ["Storvas 10", "Atorvastatin 10 mg"],
  ["Ecosprin AV 75", "Aspirin 75 mg + Atorvastatin 10 mg"],
  ["Clopilet A 75", "Clopidogrel 75 mg + Aspirin 75 mg"],
  ["Deplatt A 75", "Clopidogrel 75 mg + Aspirin 75 mg"],
  ["Concor 5", "Bisoprolol 5 mg"],
  ["Cardace 5", "Ramipril 5 mg"],
  ["Minipress XL 5", "Prazosin ER 5 mg"],
  ["Aldactone 25", "Spironolactone 25 mg"],
  ["Lasix 40", "Furosemide 40 mg"],
  ["Dytor 10", "Torasemide 10 mg"],
  // Thyroid / hormones
  ["Thyronorm 25", "Thyroxine 25 mcg"],
  ["Thyronorm 50", "Thyroxine 50 mcg"],
  ["Thyronorm 100", "Thyroxine 100 mcg"],
  ["Eltroxin 50", "Thyroxine 50 mcg"],
  ["Duphaston 10", "Dydrogesterone 10 mg"],
  ["Dydroboon", "Dydrogesterone 10 mg"],
  ["Susten 200", "Progesterone 200 mg"],
  ["Regestrone 5", "Norethisterone 5 mg"],
  ["Primolut N", "Norethisterone 5 mg"],
  ["Femara 2.5", "Letrozole 2.5 mg"],
  ["Folvite 5", "Folic acid 5 mg"],
  // Respiratory / allergy
  ["Asthalin Inhaler", "Salbutamol 100 mcg"],
  ["Foracort 200", "Budesonide 200 mcg + Formoterol 6 mcg"],
  ["Budecort 200", "Budesonide 200 mcg"],
  ["Seroflo 250", "Salmeterol 50 mcg + Fluticasone 250 mcg"],
  ["Montair LC", "Montelukast 10 mg + Levocetirizine 5 mg"],
  ["Montek LC", "Montelukast 10 mg + Levocetirizine 5 mg"],
  ["Montair 10", "Montelukast 10 mg"],
  ["Allegra 120", "Fexofenadine 120 mg"],
  ["Allegra 180", "Fexofenadine 180 mg"],
  ["Avil 25", "Pheniramine 25 mg"],
  ["Cetzine 10", "Cetirizine 10 mg"],
  ["Levocet 5", "Levocetirizine 5 mg"],
  ["Xyzal 5", "Levocetirizine 5 mg"],
  ["Ascoril LS", "Levosalbutamol + Ambroxol + Guaifenesin syrup"],
  ["Ascoril D Plus", "Dextromethorphan + Chlorpheniramine syrup"],
  ["Deriphyllin", "Etophylline + Theophylline"],
  // Vitamins / supplements
  ["Zincovit", "Multivitamin + minerals"],
  ["Becosules", "B-complex + Vitamin C"],
  ["Neurobion Forte", "Vitamin B-complex"],
  ["Supradyn", "Multivitamin + minerals"],
  ["Calcirol 60K", "Cholecalciferol 60,000 IU"],
  ["Uprise-D3 60K", "Cholecalciferol 60,000 IU"],
  ["D-Rise 60K", "Cholecalciferol 60,000 IU"],
  ["Tayo 60K", "Cholecalciferol 60,000 IU"],
  ["Shelcal 500", "Calcium + Vitamin D3"],
  ["Shelcal XT", "Calcium + Vitamin D3"],
  ["Calcimax", "Calcium + Vitamin D3 + minerals"],
  ["Limcee 500", "Vitamin C 500 mg"],
  ["Evion 400", "Vitamin E 400 mg"],
  ["Nurokind Plus", "Methylcobalamin + B-complex + Folic acid"],
  ["Fefol", "Ferrous sulphate + Folic acid"],
  ["Orofer XT", "Ferrous ascorbate + Folic acid"],
  ["Ferium XT", "Ferrous ascorbate + Folic acid"],
  ["Autrin", "Iron + Vitamin B12 + Folic acid"],
  ["Livogen", "Iron + Folic acid"],
  ["Dexorange", "Iron tonic"],
  ["Tonoferon", "Iron tonic"],
  ["A to Z", "Multivitamin + minerals"],
  ["Ovacare", "Myo-inositol blend (PCOS supplement)"],
  // Neuro / psych
  ["Nexito 10", "Escitalopram 10 mg"],
  ["Alprax 0.25", "Alprazolam 0.25 mg"],
  ["Alprax 0.5", "Alprazolam 0.5 mg"],
  ["Etizola 0.25", "Etizolam 0.25 mg"],
  ["Petril 0.5", "Clonazepam 0.5 mg"],
  ["Rivotril 0.5", "Clonazepam 0.5 mg"],
  ["Gabapin 300", "Gabapentin 300 mg"],
  ["Pregeb 75", "Pregabalin 75 mg"],
  ["Levera 500", "Levetiracetam 500 mg"],
  ["Eptoin 100", "Phenytoin 100 mg"],
  ["Valparin 200", "Sodium valproate 200 mg"],
  ["Vertin 16", "Betahistine 16 mg"],
  ["Stugeron 25", "Cinnarizine 25 mg"],
  ["Suminat 50", "Sumatriptan 50 mg"],
  ["Zolfresh 10", "Zolpidem 10 mg"],
  ["Meloset 3", "Melatonin 3 mg"],
  ["Sizodon 2", "Risperidone 2 mg"],
  ["Oleanz 5", "Olanzapine 5 mg"],
  ["Qutipin 100", "Quetiapine 100 mg"],
  ["Depsonil 25", "Imipramine 25 mg"],
  // Derma / antifungal / antiviral
  ["Forcan 150", "Fluconazole 150 mg"],
  ["Zocon 150", "Fluconazole 150 mg"],
  ["Itrasys 100", "Itraconazole 100 mg"],
  ["Canditral 200", "Itraconazole 200 mg"],
  ["Candid B Cream", "Clotrimazole 1% + Beclomethasone"],
  ["Candid Dusting Powder", "Clotrimazole"],
  ["Tenovate", "Clobetasol propionate 0.05%"],
  ["Betnovate N", "Betamethasone + Neomycin"],
  ["Fourderm", "Clotrimazole + Beclomethasone + Neomycin"],
  ["Nizral 2% Shampoo", "Ketoconazole 2%"],
  ["Scalpe Plus Shampoo", "Ketoconazole 2% + Zinc pyrithione"],
  ["Zovirax 400", "Acyclovir 400 mg"],
  ["Valcivir 500", "Valacyclovir 500 mg"],
  ["Zentel 400", "Albendazole 400 mg"],
  ["Ivermec 12", "Ivermectin 12 mg"],
  // Urology / ENT / eye
  ["Urimax 0.4", "Tamsulosin 0.4 mg"],
  ["Contiflo OD 0.4", "Tamsulosin ER 0.4 mg"],
  ["Finast 5", "Finasteride 5 mg"],
  ["Otrivin Nasal Drops", "Xylometazoline"],
  ["Nasivion Nasal Drops", "Oxymetazoline"],
  ["Ciplox Eye Drops", "Ciprofloxacin 0.3%"],
  ["Moxicip Eye Drops", "Moxifloxacin 0.5%"],
  ["Vigamox Eye Drops", "Moxifloxacin 0.5%"],
  ["Refresh Tears", "Carboxymethylcellulose 0.5%"],
  // Generic salts (for salt-first searchers)
  ["Paracetamol 650 mg", "Generic paracetamol"],
  ["Pantoprazole 40 mg", "Generic pantoprazole"],
  ["Omeprazole 20 mg", "Generic omeprazole"],
  ["Rabeprazole 20 mg", "Generic rabeprazole"],
  ["Metformin 500 mg", "Generic metformin"],
  ["Telmisartan 40 mg", "Generic telmisartan"],
  ["Amlodipine 5 mg", "Generic amlodipine"],
  ["Losartan 50 mg", "Generic losartan"],
  ["Atorvastatin 10 mg", "Generic atorvastatin"],
  ["Rosuvastatin 10 mg", "Generic rosuvastatin"],
  ["Azithromycin 500 mg", "Generic azithromycin"],
  ["Amoxicillin 500 mg", "Generic amoxicillin"],
  ["Cefixime 200 mg", "Generic cefixime"],
  ["Levofloxacin 500 mg", "Generic levofloxacin"],
  ["Cetirizine 10 mg", "Generic cetirizine"],
  ["Metoprolol 50 mg", "Generic metoprolol"],
  ["Domperidone 10 mg", "Generic domperidone"],
  ["Cholecalciferol 60,000 IU", "Vitamin D3 60K generic"],
  ["Methylcobalamin 1500 mcg", "Vitamin B12"],
  ["Montelukast + Levocetirizine", "Generic allergy combo"],
];

const LABS: [string, string][] = [
  ["HbA1c", "Glycated haemoglobin"],
  ["Fasting Blood Sugar (FBS)", "Diabetes screening"],
  ["Postprandial Blood Sugar (PPBS)", "Diabetes monitoring"],
  ["Complete Blood Count (CBC)", "Haemogram"],
  ["Lipid Profile", "Cholesterol panel"],
  ["Liver Function Test (LFT)", "Liver panel"],
  ["Kidney Function Test (KFT)", "Renal panel"],
  ["Serum Creatinine", "Kidney function"],
  ["Thyroid Profile (T3, T4, TSH)", "Full thyroid panel"],
  ["TSH", "Thyroid stimulating hormone"],
  ["Vitamin D (25-OH)", "Vitamin D deficiency"],
  ["Vitamin B12", "Cobalamin deficiency"],
  ["Iron Studies", "Ferritin + TIBC panel"],
  ["Folic Acid", "Vitamin B9"],
  ["Urine Routine & Microscopy", "Urinalysis"],
  ["Urine Culture & Sensitivity", "UTI test"],
  ["CRP", "C-reactive protein"],
  ["ESR", "Inflammation marker"],
  ["D-Dimer", "Clotting marker"],
  ["Coagulation Profile (PT/INR)", "Blood clotting"],
  ["Electrolytes (Na/K/Cl)", "Sodium, potassium, chloride"],
  ["Homocysteine", "Cardiac risk marker"],
  ["Full Body Checkup", "Comprehensive package"],
  ["Master Health Checkup", "Comprehensive package+"],
  ["Cardiac Risk Profile", "Heart risk panel"],
  ["Prostate Specific Antigen (PSA)", "Prostate screening"],
  ["Dengue NS1 Antigen", "Dengue test"],
  ["Widal Test", "Typhoid"],
  ["Malaria Parasite Test", "Malaria smear"],
  ["Typhi Dot", "Typhoid antibodies"],
  ["Covid RT-PCR", "SARS-CoV-2"],
  ["Allergy Panel", "Phadiatop inhalants"],
  ["CA-125", "Ovarian cancer marker"],
  ["Double Marker Test", "Down syndrome screening"],
  ["Triple Marker Test", "Prenatal screening"],
  ["Beta hCG", "Pregnancy confirmation"],
  ["Testosterone Total", "Male hormone"],
  ["Estradiol (E2)", "Female hormone"],
  ["Prolactin", "Pituitary hormone"],
  ["FSH & LH", "Fertility hormones"],
  ["Rheumatoid Factor (RA)", "Arthritis marker"],
  ["Anti-CCP", "Rheumatoid arthritis"],
  ["ANA (Antinuclear Antibody)", "Autoimmune screening"],
  ["H. pylori Antigen", "Stomach infection"],
];

export const CATALOG: CatalogItem[] = [
  ...MEDICINES.map(([name, hint]): CatalogItem => ({ name, hint, kind: "medicine" })),
  ...LABS.map(([name, hint]): CatalogItem => ({ name, hint, kind: "lab" })),
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Instant typeahead over the catalog. Every query token must match the item's
 * name (strong) or salt hint (weak); results ranked by match quality.
 */
export function searchCatalog(query: string, kind: CatalogKind, limit = 7): CatalogItem[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(Boolean).slice(0, 4);
  const scored: { item: CatalogItem; score: number }[] = [];
  for (const item of CATALOG) {
    if (item.kind !== kind) continue;
    const name = norm(item.name);
    const hint = norm(item.hint);
    const words = name.split(" ");
    let score = 0;
    let all = true;
    for (const t of tokens) {
      let best = 0;
      if (words.includes(t)) best = 40;
      else if (words.some((w) => w.startsWith(t))) best = 30;
      else if (name.includes(t)) best = 20;
      else if (hint.includes(t)) best = 8;
      if (best === 0) {
        all = false;
        break;
      }
      score += best;
    }
    if (!all) continue;
    if (name === q) score += 60;
    else if (name.startsWith(q)) score += 40;
    scored.push({ item, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.item.name.length - b.item.name.length || a.item.name.localeCompare(b.item.name),
  );
  return scored.slice(0, limit).map((s) => s.item);
}
