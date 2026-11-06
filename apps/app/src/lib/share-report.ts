import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Report } from './analysis';
import { reportHtml } from './report-html';

/**
 * 레포트를 PDF로 만들어 공유 메뉴를 연다. 메뉴를 닫는 것은 오류가 아니다.
 * 임시 이름 대신 AIGO-report-{id}.pdf로 옮겨 보내고, 끝나면 지운다.
 */
export async function shareReportPdf(report: Report, createdAt: string, id: string | number): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: reportHtml(report, createdAt) });
  const named = new File(Paths.cache, `AIGO-report-${id}.pdf`);
  try {
    await new File(uri).move(named, { overwrite: true });
    await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: '레포트 공유' });
  } finally {
    try {
      named.delete();
    } catch {
      // 이미 없으면 그만이다.
    }
  }
}
