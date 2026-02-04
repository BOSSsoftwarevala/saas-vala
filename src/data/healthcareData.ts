export interface HealthcareProduct {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  features: string[];
  price: number;
  originalPrice: number;
  discount?: number;
  status: 'live' | 'bestseller' | 'upcoming';
}

export const healthcareSystems: HealthcareProduct[] = [
  {
    id: 'healthcare-1',
    title: 'SMALL CLINIC MANAGEMENT SYSTEM',
    subtitle: 'Single Doctor Clinic Operations',
    image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=250&fit=crop',
    features: ['Patient registration', 'Appointment booking', 'Prescription record', 'Billing', 'Reports'],
    price: 14999,
    originalPrice: 29999,
    status: 'bestseller'
  },
  {
    id: 'healthcare-2',
    title: 'MULTI-SPECIALITY CLINIC SYSTEM',
    subtitle: 'Multi-Doctor Clinic Management',
    image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400&h=250&fit=crop',
    features: ['Doctor schedules', 'Patient records', 'Billing', 'Follow-ups', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'bestseller'
  },
  {
    id: 'healthcare-3',
    title: 'DENTAL CLINIC MANAGEMENT',
    subtitle: 'Complete Dental Practice Solution',
    image: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=250&fit=crop',
    features: ['Tooth-wise treatment', 'Appointments', 'Billing', 'Follow-ups', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'live'
  },
  {
    id: 'healthcare-4',
    title: 'HOSPITAL MANAGEMENT SYSTEM',
    subtitle: 'Full Hospital ERP Solution',
    image: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=400&h=250&fit=crop',
    features: ['OPD / IPD handling', 'Bed management', 'Billing', 'Discharge summary', 'Reports'],
    price: 99999,
    originalPrice: 199999,
    status: 'bestseller'
  },
  {
    id: 'healthcare-5',
    title: 'NURSING HOME MANAGEMENT',
    subtitle: 'Small Hospital Operations',
    image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=250&fit=crop',
    features: ['Patient admission', 'Bed allocation', 'Billing', 'Medicine tracking', 'Reports'],
    price: 49999,
    originalPrice: 99999,
    status: 'live'
  },
  {
    id: 'healthcare-6',
    title: 'DIAGNOSTIC LAB MANAGEMENT',
    subtitle: 'Pathology & Diagnostic Center',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&h=250&fit=crop',
    features: ['Test booking', 'Sample tracking', 'Report generation', 'Billing', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'bestseller'
  },
  {
    id: 'healthcare-7',
    title: 'PATHOLOGY LAB SYSTEM',
    subtitle: 'Blood & Sample Testing Lab',
    image: 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?w=400&h=250&fit=crop',
    features: ['Test catalog', 'Sample status', 'Result upload', 'Billing', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 'healthcare-8',
    title: 'RADIOLOGY / XRAY CENTER SYSTEM',
    subtitle: 'Imaging & Scan Center',
    image: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400&h=250&fit=crop',
    features: ['Scan scheduling', 'Report storage', 'Billing', 'Patient history', 'Reports'],
    price: 34999,
    originalPrice: 69999,
    status: 'live'
  },
  {
    id: 'healthcare-9',
    title: 'PHARMACY / MEDICAL STORE POS',
    subtitle: 'Medicine Retail Management',
    image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=400&h=250&fit=crop',
    features: ['Medicine billing', 'Expiry tracking', 'Stock control', 'Supplier record', 'Reports'],
    price: 14999,
    originalPrice: 29999,
    status: 'bestseller'
  },
  {
    id: 'healthcare-10',
    title: 'EYE HOSPITAL / OPTICAL CLINIC SYSTEM',
    subtitle: 'Ophthalmology Practice',
    image: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=400&h=250&fit=crop',
    features: ['Patient records', 'Prescription tracking', 'Billing', 'Follow-ups', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'live'
  },
  {
    id: 'healthcare-11',
    title: 'MATERNITY CLINIC MANAGEMENT',
    subtitle: 'Prenatal & Delivery Care',
    image: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=400&h=250&fit=crop',
    features: ['ANC records', 'Delivery tracking', 'Billing', 'Follow-ups', 'Reports'],
    price: 34999,
    originalPrice: 69999,
    status: 'live'
  },
  {
    id: 'healthcare-12',
    title: 'CHILD CARE / PEDIATRIC CLINIC SYSTEM',
    subtitle: 'Pediatric Practice Management',
    image: 'https://images.unsplash.com/photo-1578496479763-c21c718af028?w=400&h=250&fit=crop',
    features: ['Growth tracking', 'Vaccination schedule', 'Billing', 'Reminders', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'bestseller'
  },
  {
    id: 'healthcare-13',
    title: 'AYURVEDIC CLINIC MANAGEMENT',
    subtitle: 'Traditional Medicine Practice',
    image: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=400&h=250&fit=crop',
    features: ['Patient history', 'Treatment plans', 'Billing', 'Medicine record', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'live'
  },
  {
    id: 'healthcare-14',
    title: 'HOMEOPATHY CLINIC SYSTEM',
    subtitle: 'Homeopathic Practice',
    image: 'https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=400&h=250&fit=crop',
    features: ['Case records', 'Follow-ups', 'Billing', 'Prescription history', 'Reports'],
    price: 17999,
    originalPrice: 35999,
    status: 'live'
  },
  {
    id: 'healthcare-15',
    title: 'PHYSIOTHERAPY CLINIC MANAGEMENT',
    subtitle: 'Rehab & Physical Therapy',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=250&fit=crop',
    features: ['Session scheduling', 'Exercise plans', 'Billing', 'Progress tracking', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'bestseller'
  },
  {
    id: 'healthcare-16',
    title: 'DIABETES CARE CLINIC SYSTEM',
    subtitle: 'Diabetology Practice',
    image: 'https://images.unsplash.com/photo-1579684288361-5c1a2957cc38?w=400&h=250&fit=crop',
    features: ['Sugar records', 'Visit tracking', 'Billing', 'Follow-ups', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'live'
  },
  {
    id: 'healthcare-17',
    title: 'HEART CARE CLINIC SYSTEM',
    subtitle: 'Cardiology Practice',
    image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=250&fit=crop',
    features: ['Patient history', 'Test records', 'Billing', 'Follow-ups', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'live'
  },
  {
    id: 'healthcare-18',
    title: 'SKIN / DERMATOLOGY CLINIC SYSTEM',
    subtitle: 'Dermatology Practice',
    image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=250&fit=crop',
    features: ['Case photos', 'Treatment tracking', 'Billing', 'Follow-ups', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 'healthcare-19',
    title: 'ENT CLINIC MANAGEMENT',
    subtitle: 'Ear Nose Throat Practice',
    image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=400&h=250&fit=crop',
    features: ['Visit records', 'Treatment notes', 'Billing', 'Follow-ups', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'live'
  },
  {
    id: 'healthcare-20',
    title: 'ORTHOPEDIC CLINIC SYSTEM',
    subtitle: 'Bone & Joint Specialist',
    image: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400&h=250&fit=crop',
    features: ['Injury records', 'X-ray references', 'Billing', 'Follow-ups', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 'healthcare-21',
    title: 'VETERINARY CLINIC MANAGEMENT',
    subtitle: 'Animal Healthcare',
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=250&fit=crop',
    features: ['Animal records', 'Vaccination', 'Billing', 'Follow-ups', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'bestseller'
  },
  {
    id: 'healthcare-22',
    title: 'BLOOD BANK MANAGEMENT SYSTEM',
    subtitle: 'Blood Collection & Storage',
    image: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?w=400&h=250&fit=crop',
    features: ['Donor records', 'Blood stock', 'Issue tracking', 'Billing', 'Reports'],
    price: 39999,
    originalPrice: 79999,
    status: 'live'
  },
  {
    id: 'healthcare-23',
    title: 'DIALYSIS CENTER MANAGEMENT',
    subtitle: 'Kidney Dialysis Center',
    image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400&h=250&fit=crop',
    features: ['Patient scheduling', 'Session records', 'Billing', 'Follow-ups', 'Reports'],
    price: 49999,
    originalPrice: 99999,
    status: 'live'
  },
  {
    id: 'healthcare-24',
    title: 'AMBULANCE SERVICE MANAGEMENT',
    subtitle: 'Emergency Transport Service',
    image: 'https://images.unsplash.com/photo-1587745416684-47953f16f02f?w=400&h=250&fit=crop',
    features: ['Call tracking', 'Vehicle status', 'Billing', 'Payments', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 'healthcare-25',
    title: 'HOME HEALTH CARE SERVICE SYSTEM',
    subtitle: 'Home Nursing & Care',
    image: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=400&h=250&fit=crop',
    features: ['Patient visits', 'Staff assignment', 'Billing', 'Follow-ups', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'live'
  },
  {
    id: 'healthcare-26',
    title: 'MEDICAL EQUIPMENT RENTAL SYSTEM',
    subtitle: 'Equipment Hire Service',
    image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&h=250&fit=crop',
    features: ['Equipment list', 'Rental tracking', 'Billing', 'Maintenance log', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'upcoming'
  },
  {
    id: 'healthcare-27',
    title: 'MEDICAL REPRESENTATIVE MANAGEMENT',
    subtitle: 'Pharma Sales Force',
    image: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=400&h=250&fit=crop',
    features: ['Doctor visits', 'Product promotion', 'Expense tracking', 'Reports', 'Performance'],
    price: 34999,
    originalPrice: 69999,
    status: 'live'
  },
  {
    id: 'healthcare-28',
    title: 'CLINICAL RESEARCH CENTER SYSTEM',
    subtitle: 'Clinical Trials Management',
    image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&h=250&fit=crop',
    features: ['Trial records', 'Patient enrollment', 'Billing', 'Reports', 'Compliance'],
    price: 79999,
    originalPrice: 159999,
    status: 'upcoming'
  },
  {
    id: 'healthcare-29',
    title: 'PSYCHIATRY / COUNSELLING CLINIC SYSTEM',
    subtitle: 'Mental Health Practice',
    image: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=400&h=250&fit=crop',
    features: ['Session records', 'Appointment booking', 'Billing', 'Follow-ups', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 'healthcare-30',
    title: 'REHABILITATION CENTER MANAGEMENT',
    subtitle: 'Recovery & Therapy Center',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=250&fit=crop',
    features: ['Patient admission', 'Therapy plans', 'Billing', 'Follow-ups', 'Reports'],
    price: 39999,
    originalPrice: 79999,
    status: 'live'
  },
  {
    id: 'healthcare-31',
    title: 'DE-ADDICTION CENTER MANAGEMENT',
    subtitle: 'Addiction Treatment Center',
    image: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=400&h=250&fit=crop',
    features: ['Patient records', 'Program tracking', 'Billing', 'Follow-ups', 'Reports'],
    price: 34999,
    originalPrice: 69999,
    status: 'live'
  },
  {
    id: 'healthcare-32',
    title: 'HOSPITAL PHARMACY MANAGEMENT',
    subtitle: 'In-House Pharmacy Operations',
    image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=400&h=250&fit=crop',
    features: ['Medicine stock', 'Issue tracking', 'Billing', 'Purchase records', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'live'
  },
  {
    id: 'healthcare-33',
    title: 'ICU / CRITICAL CARE MANAGEMENT',
    subtitle: 'Intensive Care Unit System',
    image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400&h=250&fit=crop',
    features: ['Bed monitoring', 'Patient vitals', 'Billing', 'Logs', 'Reports'],
    price: 59999,
    originalPrice: 119999,
    status: 'live'
  },
  {
    id: 'healthcare-34',
    title: 'OPERATION THEATRE MANAGEMENT',
    subtitle: 'Surgery Scheduling System',
    image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=400&h=250&fit=crop',
    features: ['Surgery scheduling', 'OT usage', 'Billing', 'Records', 'Reports'],
    price: 49999,
    originalPrice: 99999,
    status: 'live'
  },
  {
    id: 'healthcare-35',
    title: 'MEDICAL COLLEGE MANAGEMENT',
    subtitle: 'Medical Education Institute',
    image: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=400&h=250&fit=crop',
    features: ['Student records', 'Attendance', 'Exams', 'Fees', 'Reports'],
    price: 79999,
    originalPrice: 159999,
    status: 'live'
  },
  {
    id: 'healthcare-36',
    title: 'NURSING COLLEGE MANAGEMENT',
    subtitle: 'Nursing Education Institute',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=250&fit=crop',
    features: ['Student batches', 'Clinical hours', 'Exams', 'Fees', 'Reports'],
    price: 49999,
    originalPrice: 99999,
    status: 'live'
  },
  {
    id: 'healthcare-37',
    title: 'HEALTH CHECKUP CAMP MANAGEMENT',
    subtitle: 'Medical Camp Organization',
    image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=250&fit=crop',
    features: ['Camp setup', 'Patient records', 'Test tracking', 'Billing', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'live'
  },
  {
    id: 'healthcare-38',
    title: 'NGO MEDICAL CLINIC SYSTEM',
    subtitle: 'Charitable Healthcare',
    image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400&h=250&fit=crop',
    features: ['Patient visits', 'Free service record', 'Medicine usage', 'Reports', 'Donations'],
    price: 14999,
    originalPrice: 29999,
    status: 'live'
  },
  {
    id: 'healthcare-39',
    title: 'TELECONSULTATION BACK-OFFICE SYSTEM',
    subtitle: 'Online Doctor Consultation',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=250&fit=crop',
    features: ['Appointment queue', 'Call records', 'Billing', 'Follow-ups', 'Reports'],
    price: 34999,
    originalPrice: 69999,
    status: 'bestseller'
  },
  {
    id: 'healthcare-40',
    title: 'ELDER CARE CENTER MANAGEMENT',
    subtitle: 'Senior Living Facility',
    image: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=400&h=250&fit=crop',
    features: ['Resident records', 'Care schedule', 'Billing', 'Follow-ups', 'Reports'],
    price: 39999,
    originalPrice: 79999,
    status: 'live'
  },
  {
    id: 'healthcare-41',
    title: 'PALLIATIVE CARE MANAGEMENT',
    subtitle: 'End-of-Life Care',
    image: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=400&h=250&fit=crop',
    features: ['Patient care plans', 'Visit logs', 'Billing', 'Reports', 'Follow-ups'],
    price: 29999,
    originalPrice: 59999,
    status: 'upcoming'
  },
  {
    id: 'healthcare-42',
    title: 'MEDICAL HOSTEL MANAGEMENT',
    subtitle: 'Medical Staff Housing',
    image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=400&h=250&fit=crop',
    features: ['Resident records', 'Rent tracking', 'Billing', 'Payments', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'live'
  },
  {
    id: 'healthcare-43',
    title: 'DENTAL LAB MANAGEMENT',
    subtitle: 'Dental Prosthetics Lab',
    image: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=250&fit=crop',
    features: ['Case orders', 'Work status', 'Billing', 'Delivery', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 'healthcare-44',
    title: 'MEDICAL WASTE MANAGEMENT SYSTEM',
    subtitle: 'Bio-Medical Waste Disposal',
    image: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=400&h=250&fit=crop',
    features: ['Waste category', 'Collection logs', 'Compliance', 'Billing', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'live'
  },
  {
    id: 'healthcare-45',
    title: 'HEALTH INSURANCE TPA BACK-OFFICE SYSTEM',
    subtitle: 'Insurance Claims Processing',
    image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=250&fit=crop',
    features: ['Claim records', 'Patient mapping', 'Billing', 'Follow-ups', 'Reports'],
    price: 59999,
    originalPrice: 119999,
    status: 'live'
  }
];
