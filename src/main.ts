import { Plugin } from 'obsidian';
import { normalizeData, type PublicTxtData } from './sources/schema.ts';
import { PublicTxtSettingTab } from './settings.ts';

export default class PublicTxtPlugin extends Plugin {
	/** Everything in data.json, always normalized (docs/spec.md → Data). */
	data!: PublicTxtData;

	async onload() {
		this.data = normalizeData(await this.loadData());
		this.addSettingTab(new PublicTxtSettingTab(this.app, this));
	}

	/** Normalizes `next`, keeps it, and writes it to data.json. */
	async save(next: PublicTxtData): Promise<void> {
		this.data = normalizeData(next);
		await this.saveData(this.data);
	}
}
