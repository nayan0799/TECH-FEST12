import type {Team,Standing} from './types';
export function rankTeams(teams:Team[],order:number[]):Standing[];
export function remaining(level:{status:string;remaining:number;started_at:string|null},now:number):number;
export function csv(rows:Record<string,unknown>[]):string;
