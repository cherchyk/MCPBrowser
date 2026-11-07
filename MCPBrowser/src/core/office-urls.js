export function isOfficeEditorHost(hostname) {
  return hostname === 'officeapps.live.com' || hostname.endsWith('.officeapps.live.com');
}

export function isSharePointHost(hostname) {
  return hostname === 'sharepoint.com' || hostname.endsWith('.sharepoint.com');
}

export function isAuthenticationUrl(value) {
  try {
    const hostname = new URL(value).hostname;
    return (
      hostname === 'login.microsoftonline.com' ||
      hostname.endsWith('.login.microsoftonline.com') ||
      hostname === 'login.live.com' ||
      hostname === 'account.live.com'
    );
  } catch {
    return false;
  }
}

export function isExcelDocumentUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (['excel.cloud.microsoft', 'excel.office.com'].includes(url.hostname)) return true;
    if (isOfficeEditorHost(url.hostname)) {
      return (
        /(?:^|-)excel(?:-|\.officeapps\.live\.com$)/i.test(url.hostname) ||
        /^\/x\//i.test(url.pathname)
      );
    }
    if (isSharePointHost(url.hostname) || url.hostname === 'onedrive.live.com') {
      return (
        /\/:x:\//i.test(url.pathname) ||
        /\.(xlsx|xlsm|xlsb|xls)$/i.test(url.pathname) ||
        /\.(xlsx|xlsm|xlsb|xls)$/i.test(url.searchParams.get('file') || '')
      );
    }
    return false;
  } catch {
    return false;
  }
}
