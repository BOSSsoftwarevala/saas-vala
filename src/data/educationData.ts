export interface EducationProduct {
  id: number;
  title: string;
  subtitle: string;
  image: string;
  features: string[];
  price: number;
  originalPrice: number;
  status: 'live' | 'bestseller' | 'upcoming';
}

export const educationProducts: EducationProduct[] = [
  {
    id: 1,
    title: 'SCHOOL MANAGEMENT SYSTEM',
    subtitle: 'Complete K-12 School Operations',
    image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400&h=250&fit=crop',
    features: ['Student records', 'Attendance', 'Fees', 'Exams', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'bestseller'
  },
  {
    id: 2,
    title: 'COLLEGE MANAGEMENT SYSTEM',
    subtitle: 'Higher Education Administration',
    image: 'https://images.unsplash.com/photo-1562774053-701939374585?w=400&h=250&fit=crop',
    features: ['Admissions', 'Attendance', 'Exams', 'Fees', 'Reports'],
    price: 34999,
    originalPrice: 69999,
    status: 'live'
  },
  {
    id: 3,
    title: 'UNIVERSITY MANAGEMENT SYSTEM',
    subtitle: 'Multi-Department University Control',
    image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=400&h=250&fit=crop',
    features: ['Departments', 'Students', 'Exams', 'Fees', 'Reports'],
    price: 49999,
    originalPrice: 99999,
    status: 'live'
  },
  {
    id: 4,
    title: 'COACHING INSTITUTE MANAGEMENT',
    subtitle: 'Competitive Exam Coaching Center',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=250&fit=crop',
    features: ['Batch management', 'Attendance', 'Fees', 'Test records', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'bestseller'
  },
  {
    id: 5,
    title: 'TUITION CLASS MANAGEMENT',
    subtitle: 'Home Tuition & Small Classes',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=250&fit=crop',
    features: ['Student tracking', 'Monthly fees', 'Attendance', 'Homework', 'Reports'],
    price: 9999,
    originalPrice: 19999,
    status: 'live'
  },
  {
    id: 6,
    title: 'ONLINE COURSE MANAGEMENT (LMS)',
    subtitle: 'E-Learning Platform',
    image: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=400&h=250&fit=crop',
    features: ['Course creation', 'Student enrollment', 'Progress tracking', 'Certificates', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'bestseller'
  },
  {
    id: 7,
    title: 'TRAINING INSTITUTE MANAGEMENT',
    subtitle: 'Professional Training Center',
    image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=400&h=250&fit=crop',
    features: ['Course scheduling', 'Student records', 'Fees', 'Certification', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 8,
    title: 'PLAY SCHOOL / PRE-SCHOOL SYSTEM',
    subtitle: 'Early Childhood Education',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=250&fit=crop',
    features: ['Child profiles', 'Attendance', 'Fee tracking', 'Parent notes', 'Reports'],
    price: 14999,
    originalPrice: 29999,
    status: 'live'
  },
  {
    id: 9,
    title: 'KINDERGARTEN MANAGEMENT SYSTEM',
    subtitle: 'Nursery & KG Operations',
    image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400&h=250&fit=crop',
    features: ['Student care logs', 'Attendance', 'Fees', 'Activities', 'Reports'],
    price: 12999,
    originalPrice: 25999,
    status: 'live'
  },
  {
    id: 10,
    title: 'ISLAMIC SCHOOL / MADRASA MANAGEMENT',
    subtitle: 'Religious Education Center',
    image: 'https://images.unsplash.com/photo-1585036156171-384164a8c675?w=400&h=250&fit=crop',
    features: ['Student records', 'Attendance', 'Fees', 'Course tracking', 'Reports'],
    price: 17999,
    originalPrice: 35999,
    status: 'live'
  },
  {
    id: 11,
    title: 'CHRISTIAN SCHOOL MANAGEMENT',
    subtitle: 'Faith-Based Education',
    image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&h=250&fit=crop',
    features: ['Student profiles', 'Attendance', 'Fees', 'Exams', 'Reports'],
    price: 17999,
    originalPrice: 35999,
    status: 'live'
  },
  {
    id: 12,
    title: 'GURUKUL / TRADITIONAL SCHOOL SYSTEM',
    subtitle: 'Traditional Indian Education',
    image: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=400&h=250&fit=crop',
    features: ['Student batches', 'Discipline tracking', 'Fees', 'Attendance', 'Reports'],
    price: 14999,
    originalPrice: 29999,
    status: 'upcoming'
  },
  {
    id: 13,
    title: 'VOCATIONAL TRAINING INSTITUTE SYSTEM',
    subtitle: 'Skill Development Center',
    image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&h=250&fit=crop',
    features: ['Skill courses', 'Student tracking', 'Attendance', 'Fees', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'live'
  },
  {
    id: 14,
    title: 'IT TRAINING INSTITUTE MANAGEMENT',
    subtitle: 'Computer & Software Training',
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=250&fit=crop',
    features: ['Course batches', 'Student progress', 'Fees', 'Certificates', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'bestseller'
  },
  {
    id: 15,
    title: 'COMPUTER EDUCATION CENTER SYSTEM',
    subtitle: 'Basic Computer Training',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=250&fit=crop',
    features: ['Student enrollment', 'Attendance', 'Fees', 'Practical logs', 'Reports'],
    price: 14999,
    originalPrice: 29999,
    status: 'live'
  },
  {
    id: 16,
    title: 'LANGUAGE LEARNING INSTITUTE SYSTEM',
    subtitle: 'Foreign Language Training',
    image: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=250&fit=crop',
    features: ['Batch tracking', 'Attendance', 'Fees', 'Progress', 'Reports'],
    price: 17999,
    originalPrice: 35999,
    status: 'live'
  },
  {
    id: 17,
    title: 'SPOKEN ENGLISH INSTITUTE MANAGEMENT',
    subtitle: 'English Communication Training',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=250&fit=crop',
    features: ['Student batches', 'Attendance', 'Fees', 'Practice logs', 'Reports'],
    price: 12999,
    originalPrice: 25999,
    status: 'live'
  },
  {
    id: 18,
    title: 'DANCE ACADEMY MANAGEMENT SYSTEM',
    subtitle: 'Dance Training Institute',
    image: 'https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff?w=400&h=250&fit=crop',
    features: ['Batch scheduling', 'Attendance', 'Fees', 'Performance records', 'Reports'],
    price: 14999,
    originalPrice: 29999,
    status: 'live'
  },
  {
    id: 19,
    title: 'MUSIC ACADEMY MANAGEMENT SYSTEM',
    subtitle: 'Music & Instrument Training',
    image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=250&fit=crop',
    features: ['Instrument batches', 'Attendance', 'Fees', 'Practice tracking', 'Reports'],
    price: 14999,
    originalPrice: 29999,
    status: 'bestseller'
  },
  {
    id: 20,
    title: 'SINGING CLASS MANAGEMENT SYSTEM',
    subtitle: 'Vocal Music Training',
    image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=250&fit=crop',
    features: ['Student batches', 'Attendance', 'Fees', 'Performance notes', 'Reports'],
    price: 12999,
    originalPrice: 25999,
    status: 'live'
  },
  {
    id: 21,
    title: 'ACTING SCHOOL MANAGEMENT SYSTEM',
    subtitle: 'Film & Theatre Acting',
    image: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=400&h=250&fit=crop',
    features: ['Course tracking', 'Attendance', 'Fees', 'Performance logs', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'upcoming'
  },
  {
    id: 22,
    title: 'DRAMA / THEATRE ACADEMY SYSTEM',
    subtitle: 'Stage Performance Training',
    image: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=400&h=250&fit=crop',
    features: ['Batch schedules', 'Attendance', 'Fees', 'Show records', 'Reports'],
    price: 17999,
    originalPrice: 35999,
    status: 'live'
  },
  {
    id: 23,
    title: 'ART & PAINTING INSTITUTE SYSTEM',
    subtitle: 'Fine Arts Training Center',
    image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=250&fit=crop',
    features: ['Student records', 'Attendance', 'Fees', 'Artwork tracking', 'Reports'],
    price: 14999,
    originalPrice: 29999,
    status: 'live'
  },
  {
    id: 24,
    title: 'DESIGN INSTITUTE MANAGEMENT',
    subtitle: 'Graphic & Interior Design',
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=250&fit=crop',
    features: ['Course batches', 'Attendance', 'Fees', 'Portfolio tracking', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 25,
    title: 'FASHION DESIGN INSTITUTE SYSTEM',
    subtitle: 'Fashion & Apparel Design',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=250&fit=crop',
    features: ['Student profiles', 'Attendance', 'Fees', 'Project records', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'live'
  },
  {
    id: 26,
    title: 'BEAUTY & MAKEUP ACADEMY SYSTEM',
    subtitle: 'Cosmetology Training',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=250&fit=crop',
    features: ['Batch tracking', 'Attendance', 'Fees', 'Certification', 'Reports'],
    price: 17999,
    originalPrice: 35999,
    status: 'bestseller'
  },
  {
    id: 27,
    title: 'COOKING / CULINARY SCHOOL SYSTEM',
    subtitle: 'Culinary Arts Training',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=250&fit=crop',
    features: ['Course batches', 'Attendance', 'Fees', 'Practical logs', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'live'
  },
  {
    id: 28,
    title: 'HOTEL MANAGEMENT COLLEGE SYSTEM',
    subtitle: 'Hospitality Education',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=250&fit=crop',
    features: ['Student records', 'Attendance', 'Exams', 'Fees', 'Reports'],
    price: 34999,
    originalPrice: 69999,
    status: 'live'
  },
  {
    id: 29,
    title: 'NURSING SCHOOL MANAGEMENT SYSTEM',
    subtitle: 'Nursing & Healthcare Education',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=250&fit=crop',
    features: ['Student batches', 'Clinical hours', 'Exams', 'Fees', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'live'
  },
  {
    id: 30,
    title: 'MEDICAL COACHING INSTITUTE SYSTEM',
    subtitle: 'NEET & Medical Entrance',
    image: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=400&h=250&fit=crop',
    features: ['Course tracking', 'Attendance', 'Fees', 'Test records', 'Reports'],
    price: 34999,
    originalPrice: 69999,
    status: 'bestseller'
  },
  {
    id: 31,
    title: 'LAW COLLEGE MANAGEMENT SYSTEM',
    subtitle: 'Legal Education Institute',
    image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=250&fit=crop',
    features: ['Student records', 'Attendance', 'Exams', 'Fees', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'live'
  },
  {
    id: 32,
    title: 'CIVIL SERVICES COACHING SYSTEM',
    subtitle: 'UPSC & State PSC Coaching',
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=250&fit=crop',
    features: ['Batch schedules', 'Attendance', 'Fees', 'Test tracking', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'bestseller'
  },
  {
    id: 33,
    title: 'COMPETITIVE EXAM COACHING SYSTEM',
    subtitle: 'Bank, SSC, Railway Coaching',
    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=250&fit=crop',
    features: ['Student batches', 'Attendance', 'Fees', 'Test series', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 34,
    title: 'SPORTS ACADEMY MANAGEMENT SYSTEM',
    subtitle: 'Multi-Sport Training Center',
    image: 'https://images.unsplash.com/photo-1461896836934- voices62c0448?w=400&h=250&fit=crop',
    features: ['Player records', 'Attendance', 'Fees', 'Performance tracking', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 35,
    title: 'MARTIAL ARTS ACADEMY SYSTEM',
    subtitle: 'Karate, Taekwondo, Judo',
    image: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=400&h=250&fit=crop',
    features: ['Student levels', 'Attendance', 'Fees', 'Belt records', 'Reports'],
    price: 17999,
    originalPrice: 35999,
    status: 'live'
  },
  {
    id: 36,
    title: 'YOGA INSTITUTE MANAGEMENT SYSTEM',
    subtitle: 'Yoga & Wellness Training',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=250&fit=crop',
    features: ['Batch schedules', 'Attendance', 'Fees', 'Health notes', 'Reports'],
    price: 14999,
    originalPrice: 29999,
    status: 'bestseller'
  },
  {
    id: 37,
    title: 'FITNESS TRAINER INSTITUTE SYSTEM',
    subtitle: 'Personal Trainer Certification',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=250&fit=crop',
    features: ['Student tracking', 'Attendance', 'Fees', 'Certification', 'Reports'],
    price: 19999,
    originalPrice: 39999,
    status: 'live'
  },
  {
    id: 38,
    title: 'TEACHER TRAINING INSTITUTE SYSTEM',
    subtitle: 'B.Ed & Teacher Certification',
    image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=400&h=250&fit=crop',
    features: ['Trainee records', 'Attendance', 'Exams', 'Fees', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 39,
    title: 'SPECIAL EDUCATION CENTER SYSTEM',
    subtitle: 'Learning Disability Support',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=250&fit=crop',
    features: ['Student care plans', 'Attendance', 'Fees', 'Progress notes', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  },
  {
    id: 40,
    title: 'AUTISM / THERAPY LEARNING CENTER',
    subtitle: 'Autism & ABA Therapy',
    image: 'https://images.unsplash.com/photo-1491013516836-7db643ee125a?w=400&h=250&fit=crop',
    features: ['Student profiles', 'Session tracking', 'Fees', 'Progress logs', 'Reports'],
    price: 29999,
    originalPrice: 59999,
    status: 'upcoming'
  },
  {
    id: 41,
    title: 'ONLINE EXAM MANAGEMENT SYSTEM',
    subtitle: 'Digital Assessment Platform',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=250&fit=crop',
    features: ['Exam setup', 'Student attempts', 'Result generation', 'Reports', 'Analytics'],
    price: 19999,
    originalPrice: 39999,
    status: 'bestseller'
  },
  {
    id: 42,
    title: 'LIBRARY MANAGEMENT SYSTEM',
    subtitle: 'Digital Library Operations',
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=250&fit=crop',
    features: ['Book records', 'Issue / return', 'Student access', 'Fines', 'Reports'],
    price: 14999,
    originalPrice: 29999,
    status: 'live'
  },
  {
    id: 43,
    title: 'HOSTEL MANAGEMENT FOR STUDENTS',
    subtitle: 'Student Accommodation',
    image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=400&h=250&fit=crop',
    features: ['Room allocation', 'Attendance', 'Fees', 'Complaints', 'Reports'],
    price: 17999,
    originalPrice: 35999,
    status: 'live'
  },
  {
    id: 44,
    title: 'EDUCATION NGO MANAGEMENT SYSTEM',
    subtitle: 'Non-Profit Education Support',
    image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&h=250&fit=crop',
    features: ['Student sponsorship', 'Attendance', 'Fee aid tracking', 'Reports', 'Donor records'],
    price: 19999,
    originalPrice: 39999,
    status: 'live'
  },
  {
    id: 45,
    title: 'SKILL DEVELOPMENT CENTER SYSTEM',
    subtitle: 'Government Skill Programs',
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&h=250&fit=crop',
    features: ['Course enrollment', 'Attendance', 'Fees', 'Certification', 'Reports'],
    price: 24999,
    originalPrice: 49999,
    status: 'live'
  }
];
