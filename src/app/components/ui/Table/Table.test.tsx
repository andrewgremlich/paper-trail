import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Table, TBody, TD, TH, THead, TR } from "./index";

describe("Table", () => {
	it("renders table element wrapped in div", () => {
		const html = renderToStaticMarkup(
			<Table>
				<tbody>
					<tr>
						<td>Cell</td>
					</tr>
				</tbody>
			</Table>,
		);
		expect(html).toContain("<table");
		expect(html).toContain("<div");
	});

	it("applies custom className to table", () => {
		const html = renderToStaticMarkup(
			<Table className="custom-table">
				<tbody>
					<tr>
						<td>Cell</td>
					</tr>
				</tbody>
			</Table>,
		);
		expect(html).toContain("custom-table");
	});
});

describe("THead", () => {
	it("renders thead element", () => {
		const html = renderToStaticMarkup(
			<THead>
				<tr>
					<th>Header</th>
				</tr>
			</THead>,
		);
		expect(html).toContain("<thead");
	});

	it("applies custom className", () => {
		const html = renderToStaticMarkup(
			<THead className="custom-thead">
				<tr>
					<th>Header</th>
				</tr>
			</THead>,
		);
		expect(html).toContain("custom-thead");
	});
});

describe("TBody", () => {
	it("renders tbody element", () => {
		const html = renderToStaticMarkup(
			<TBody>
				<tr>
					<td>Cell</td>
				</tr>
			</TBody>,
		);
		expect(html).toContain("<tbody");
	});

	it("applies custom className", () => {
		const html = renderToStaticMarkup(
			<TBody className="custom-tbody">
				<tr>
					<td>Cell</td>
				</tr>
			</TBody>,
		);
		expect(html).toContain("custom-tbody");
	});
});

describe("TR", () => {
	it("renders tr element", () => {
		const html = renderToStaticMarkup(
			<TR>
				<td>Cell</td>
			</TR>,
		);
		expect(html).toContain("<tr");
	});

	it("applies custom className", () => {
		const html = renderToStaticMarkup(
			<TR className="custom-tr">
				<td>Cell</td>
			</TR>,
		);
		expect(html).toContain("custom-tr");
	});
});

describe("TH", () => {
	it("renders th element", () => {
		const html = renderToStaticMarkup(<TH>Header</TH>);
		expect(html).toContain("<th");
		expect(html).toContain("Header");
	});

	it("applies custom className", () => {
		const html = renderToStaticMarkup(<TH className="custom-th">Header</TH>);
		expect(html).toContain("custom-th");
	});
});

describe("TD", () => {
	it("renders td element", () => {
		const html = renderToStaticMarkup(<TD>Cell</TD>);
		expect(html).toContain("<td");
		expect(html).toContain("Cell");
	});

	it("applies custom className", () => {
		const html = renderToStaticMarkup(<TD className="custom-td">Cell</TD>);
		expect(html).toContain("custom-td");
	});
});

describe("Table Integration", () => {
	it("renders complete table structure", () => {
		const html = renderToStaticMarkup(
			<Table>
				<THead>
					<TR>
						<TH>Name</TH>
						<TH>Value</TH>
					</TR>
				</THead>
				<TBody>
					<TR>
						<TD>Item 1</TD>
						<TD>$100</TD>
					</TR>
				</TBody>
			</Table>,
		);

		expect(html).toContain("Name");
		expect(html).toContain("Value");
		expect(html).toContain("Item 1");
		expect(html).toContain("$100");
	});
});
