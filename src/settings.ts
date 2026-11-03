// Settings tab for the top-level fields of data.json (docs/spec.md → Data).
// Sources get their own UI later (build order step 3).

import { App, PluginSettingTab, Setting } from 'obsidian';
import type PublicTxtPlugin from './main.ts';
import { DEFAULT_DATA, type PublicTxtData } from './sources/schema.ts';

type TextField = 'forkFolder' | 'remotesFolder' | 'gitPath';

export class PublicTxtSettingTab extends PluginSettingTab {
	private readonly plugin: PublicTxtPlugin;

	constructor(app: App, plugin: PublicTxtPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.text('forkFolder', 'Fork folder', 'Default vault folder for forked notes. Empty: the vault root.');
		this.text('remotesFolder', 'Remotes folder', 'Vault folder holding the git clones of your sources.');
		this.text('gitPath', 'Git executable', 'Path to git. Set it if Obsidian can\'t find git on your PATH.');
	}

	/** A text setting bound to one field. The input keeps what was typed; the saved value is normalized. */
	private text(field: TextField, name: string, desc: string): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((t) =>
				t
					.setPlaceholder(DEFAULT_DATA[field])
					.setValue(this.plugin.data[field])
					.onChange(async (value) => {
						const next: PublicTxtData = { ...this.plugin.data, [field]: value };
						await this.plugin.save(next);
					}),
			);
	}
}
