import * as vscode from 'vscode';

/**
 * Copies text to the system clipboard and shows a notification.
 */
export async function copyToClipboard(text: string, message?: string): Promise<void> {
  await vscode.env.clipboard.writeText(text);
  vscode.window.showInformationMessage(message || 'Copied to clipboard.');
}
