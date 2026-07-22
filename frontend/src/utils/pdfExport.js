import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Captures rendered daily log sheets and compiles them into a multi-page PDF document.
 * 
 * @param {string} containerId - The HTML id of the wrapper containing log sheets.
 * @param {string} filename - The name of the file to save.
 */
export const exportLogsToPdf = async (containerId, filename = 'fmcsa_daily_logs.pdf') => {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container elements with id "${containerId}" not found.`);
    return;
  }

  // Retrieve all daily log sheets
  const pages = container.getElementsByClassName('log-sheet-page');
  if (pages.length === 0) {
    console.error("No log sheet pages found to export.");
    return;
  }

  // Create a portrait A4 PDF document
  // standard A4 dimensions: 595.28 x 841.89 points
  const pdf = new jsPDF('p', 'pt', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  
  // Outer margin
  const margin = 20;
  const contentWidth = pdfWidth - (margin * 2);

  for (let i = 0; i < pages.length; i++) {
    const pageElement = pages[i];
    
    // Add page if it is after the first element
    if (i > 0) {
      pdf.addPage();
    }
    
    // Render element to canvas
    const canvas = await html2canvas(pageElement, {
      scale: 2, // High resolution scaling
      useCORS: true,
      backgroundColor: '#0b0f19', // Match app's dark-900 panels background
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Calculate aspect ratio height
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // If the image is taller than the page content area, scale it down to fit height
    let renderHeight = imgHeight;
    let renderWidth = imgWidth;
    const maxContentHeight = pdfHeight - (margin * 2);
    
    if (imgHeight > maxContentHeight) {
      renderHeight = maxContentHeight;
      renderWidth = (canvas.width * renderHeight) / canvas.height;
    }
    
    // Centering the image horizontally on the page
    const xPos = margin + (contentWidth - renderWidth) / 2;
    const yPos = margin + (maxContentHeight - renderHeight) / 2;

    pdf.addImage(imgData, 'PNG', xPos, yPos, renderWidth, renderHeight);
  }

  // Save the generated document
  pdf.save(filename);
};
