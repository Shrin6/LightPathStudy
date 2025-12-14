import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    return false;
  }
};

export const exportToTxt = (content: string, filename: string = 'export.txt') => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToPdf = (content: string, title: string = 'Document', filename: string = 'export.pdf') => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(16);
  doc.text(title, 15, 15);
  
  // Add content
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(content, 180);
  doc.text(lines, 15, 30);
  
  doc.save(filename);
};

export const exportToDocx = async (content: string, filename: string = 'export.docx') => {
  const paragraphs = content.split('\n').map(line => 
    new Paragraph({
      children: [new TextRun(line || ' ')]
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs
    }]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportWorksheetToPdf = (
  title: string,
  sections: { type: string; content: string }[],
  filename: string = 'worksheet.pdf'
) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 15, 15);
  
  let yPos = 30;
  
  sections.forEach((section, idx) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 15;
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${idx + 1}. ${section.type}`, 15, yPos);
    yPos += 7;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(section.content, 180);
    doc.text(lines, 20, yPos);
    yPos += lines.length * 5 + 10;
  });
  
  doc.save(filename);
};
