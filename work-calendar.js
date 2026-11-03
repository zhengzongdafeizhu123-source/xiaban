/* Official source: https://www.gov.cn/zhengce/content/202511/content_7047090.htm
   Retrieved 2026-11-02. Holidays include the full announced break; make-up days override weekends. */
(function (root) {
  'use strict';
  root.WorkCalendars = {
    '2026': {
      source: 'https://www.gov.cn/zhengce/content/202511/content_7047090.htm',
      retrieved: '2026-11-02',
      holidays: [
        ['01-01', '01-03'], ['02-15', '02-23'], ['04-04', '04-06'],
        ['05-01', '05-05'], ['06-19', '06-21'], ['09-25', '09-27'], ['10-01', '10-07']
      ],
      workdays: ['01-04', '02-14', '02-28', '05-09', '09-20', '10-10']
    }
  };
})(typeof window === 'undefined' ? globalThis : window);
