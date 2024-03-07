export enum GUIActionType {
    TEXTQUERY = 'TEXTQUERY',
    SIMILARITY = 'SIMILARITY',
    FILESIMILARITY = 'FILESIMILARITY',
    HISTORYQUERY = 'HISTORYQUERY', 
    INSPECTFULLIMAGE = 'INSPECTFULLIMAGE',
    HIDEFULLIMAGE = 'HIDEFULLIMAGE',
    NEXTPAGE = 'NEXTPAGE',
    PREVPAGE = 'PREVPAGE',
    SHOWHELP = 'SHOWHELP',
    RESETQUERY = 'RESETQUERY',
    SUBMIT = 'SUBMIT',
    SUBMITANSWER = 'SUBMITANSWER', 
    CLEARQUERY = 'CLEARQUERY'
  }
  
export interface GUIAction { 
    timestamp: number;
    actionType: GUIActionType;
    page?: string;
    info?: string; 
    item?: number; 
    results?: Array<string>;
}