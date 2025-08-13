export const formatDateString = (isoString:string):string => {
  const date = new Date(isoString);
  const now = new Date();
  
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear();
  
  // Check if the year is current year
  if (date.getFullYear() === now.getFullYear()) {
    return `${day} ${month}`;  // e.g. "12 May"
  } else {
    return `${day} ${month} ${year}`;  // e.g. "15 Oct 2022"
  }
};