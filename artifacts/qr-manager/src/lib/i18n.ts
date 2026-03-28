export type Language = 'en' | 'ar';

export const translations = {
  en: {
    app_title: "QR Asset Manager",
    app_subtitle: "Intelligent document processing for LogiKal orders.",
    upload_title: "Upload Document",
    upload_desc: "Upload your Orgadata Glass/Panel Order (.docx) to automatically extract positions and embed tracking QR codes.",
    drop_active: "Drop the Word document here...",
    drop_idle: "Drag & drop your .docx file here",
    browse_files: "Browse Files",
    file_type_hint: "Supports standard Orgadata Word documents",
    processing: "Processing Document...",
    analyzing: "Analyzing positions and generating QR codes.",
    success_title: "Document Processed",
    success_desc: "Successfully extracted positions and embedded QR codes.",
    total_positions: "Total Positions Found",
    project_name: "Project Name",
    date: "Document Date",
    download_btn: "Download Updated Document",
    table_position: "Position / Number",
    table_qty: "Qty",
    table_width: "Width",
    table_height: "Height",
    table_qr: "QR Preview",
    error_generic: "An error occurred while processing the document.",
    error_file_type: "Invalid file type. Please upload a .docx file.",
    back_home: "Process Another Document"
  },
  ar: {
    app_title: "مدير QR للأصول",
    app_subtitle: "معالجة ذكية للمستندات لطلبات LogiKal.",
    upload_title: "رفع المستند",
    upload_desc: "قم برفع طلب الزجاج/الألواح من Orgadata (ملف .docx) لاستخراج المواقع تلقائيًا وتضمين رموز الاستجابة السريعة (QR).",
    drop_active: "أفلت ملف Word هنا...",
    drop_idle: "اسحب وأفلت ملف .docx هنا",
    browse_files: "تصفح الملفات",
    file_type_hint: "يدعم مستندات Orgadata Word القياسية",
    processing: "جاري معالجة المستند...",
    analyzing: "جاري تحليل المواقع وإنشاء رموز الاستجابة السريعة.",
    success_title: "تمت معالجة المستند",
    success_desc: "تم استخراج المواقع وتضمين رموز QR بنجاح.",
    total_positions: "إجمالي المواقع التي تم العثور عليها",
    project_name: "اسم المشروع",
    date: "تاريخ المستند",
    download_btn: "تنزيل المستند المحدث",
    table_position: "الموقع / الرقم",
    table_qty: "الكمية",
    table_width: "العرض",
    table_height: "الارتفاع",
    table_qr: "معاينة QR",
    error_generic: "حدث خطأ أثناء معالجة المستند.",
    error_file_type: "نوع الملف غير صالح. يرجى رفع ملف .docx.",
    back_home: "معالجة مستند آخر"
  }
};

export type TranslationKey = keyof typeof translations.en;
