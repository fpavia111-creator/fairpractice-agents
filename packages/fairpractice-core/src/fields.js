// Column names practice, home care, HR and compliance exports use. Aliases are common header
// spellings written from public help pages and general knowledge, NOT checked against real
// exports. A setup confirms them with `<agent> sources`.
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const PATIENT_ID = t(['Patient ID', 'Patient #', 'Patient Number', 'MRN', 'Medical Record Number', 'Chart #', 'Chart Number', 'Account #', 'Client ID', 'Client #', 'Person ID', 'Member ID'], { phi: 'mrn', translate: false });
export const PATIENT_NAME = t(['Patient', 'Patient Name', 'Name', 'Client', 'Client Name', 'Member', 'Member Name', 'Beneficiary', 'Patient Full Name'], { phi: 'name' });
export const STAFF_ID = t(['Employee ID', 'Employee #', 'Emp ID', 'Staff ID', 'Worker ID', 'Caregiver ID', 'Badge', 'Person ID', 'User ID'], { phi: 'mrn', translate: false });
export const STAFF_NAME = t(['Employee', 'Employee Name', 'Staff', 'Staff Name', 'Name', 'Full Name', 'Worker', 'Caregiver', 'Caregiver Name', 'Aide', 'Provider Name', 'Person'], { phi: 'name' });
export const PROVIDER = t(['Provider', 'Rendering Provider', 'Rendering', 'Clinician', 'Therapist', 'Physician', 'Doctor', 'Practitioner', 'Provider Name']);
export const NPI = t(['NPI', 'Provider NPI', 'Rendering NPI', 'Individual NPI'], { translate: false });
export const PAYER = t(['Payer', 'Payer Name', 'Primary Payer', 'Insurance', 'Insurance Name', 'Plan', 'Plan Name', 'Payor', 'Carrier', 'Financial Class']);
export const CLAIM_ID = t(['Claim', 'Claim ID', 'Claim #', 'Claim Number', 'Encounter', 'Encounter ID', 'Visit ID', 'Invoice', 'Invoice #', 'Ticket'], { translate: false });
export const CPT = t(['CPT', 'Code', 'Procedure', 'Procedure Code', 'CPT/HCPCS', 'HCPCS', 'Service Code', 'Proc Code', 'CPT Code'], { translate: false });
export const MODIFIER_COL = t(['Modifiers', 'Modifier', 'Mod', 'Mods', 'Modifier 1', 'Mod 1']);
export const UNITS = t(['Units', 'Unit', 'Qty', 'Quantity', 'Days/Units', 'Service Units'], { type: 'number' });
export const MINUTES = t(['Minutes', 'Min', 'Mins', 'Duration', 'Duration (min)', 'Time (min)', 'Total Minutes', 'Treatment Minutes'], { type: 'number' });
export const DOS = t(['Date of Service', 'DOS', 'Service Date', 'Visit Date', 'Date', 'From DOS', 'Session Date', 'Appointment Date'], { type: 'date' });
export const CHARGE = t(['Charge', 'Charges', 'Billed', 'Billed Amount', 'Amount', 'Fee', 'Total Charge'], { type: 'money' });
export const PAID = t(['Paid', 'Paid Amount', 'Payment', 'Insurance Paid', 'Amount Paid', 'Allowed Paid'], { type: 'money' });
export const AMOUNT = t(['Amount', 'Amt', 'Total', 'Balance', 'Net Amount', 'Payment Amount', 'Paid', 'Paid Amount'], { type: 'money' });
export const DEPARTMENT = t(['Department', 'Dept', 'Unit', 'Location', 'Site', 'Cost Center', 'Clinic']);
export const ROLE = t(['Role', 'Job Title', 'Title', 'Position', 'Job', 'Discipline', 'Job Code']);
export const HIRE_DATE = t(['Hire Date', 'Start Date', 'Date Hired', 'Hired', 'Original Hire Date'], { type: 'date' });
export const STATUS = t(['Status', 'Employment Status', 'State', 'Current Status']);
// ---- added in 0.2.0 for Fairpractice wave 2 (additions only; the definitions above are unchanged) ----
export const ACCOUNT = t(['Account', 'Account #', 'Account Number', 'Patient Account', 'Acct', 'Acct #', 'Encounter #', 'HAR', 'FIN', 'Visit #'], { phi: 'account', translate: false });
export const NDC = t(['NDC', 'NDC Code', 'National Drug Code', 'NDC 11', 'NDC11', 'Drug NDC', 'Product NDC'], { translate: false });
export const REV_CODE = t(['Revenue Code', 'Rev Code', 'Rev', 'UB Rev Code', 'RC', 'Rev Cd'], { translate: false });
export const ADMIT = t(['Admit Date', 'Admission Date', 'Admitted', 'Admit', 'Admit Dt'], { type: 'date', translate: false });
export const DISCHARGE = t(['Discharge Date', 'Discharged', 'Discharge', 'Disch Date', 'Discharge Dt'], { type: 'date', translate: false });
export const DX = t(['Diagnosis', 'Diagnoses', 'Dx', 'ICD-10', 'ICD10', 'Diagnosis Codes', 'Dx Codes', 'ICD Codes'], { translate: false });
export const DRUG = t(['Drug', 'Drug Name', 'Medication', 'Product', 'Product Name', 'Item Description'], { translate: false });
export const PHONE = t(['Phone', 'Phone Number', 'Mobile', 'Cell', 'Cell Phone', 'Mobile Number', 'Patient Phone'], { phi: 'phone', translate: 'phone' });
export const ORG = t(['Organization', 'Org', 'Facility', 'Group', 'Practice', 'Entity', 'Hospital'], { translate: 'company' });
