// Site-wide identity and links. Edit here; every page reads from this file.

export const SITE = {
	name: 'Chao Wang',
	role: 'Research Assistant Professor',
	department: 'Department of Earth, Marine and Environmental Sciences',
	institution: 'University of North Carolina at Chapel Hill',
	lead: 'I use satellites, field data, and machine learning to measure how forests change and how water levels vary across coastal bays.',
	description:
		'Chao Wang is a Research Assistant Professor at UNC-Chapel Hill working on GeoAI, forest biomass, and coastal water levels with satellite and field data.',
};

export const NAV = [
	{ label: 'Research', href: '/research/' },
	{ label: 'Publications', href: '/publications/' },
	{ label: 'Teaching', href: '/teaching/' },
	{ label: 'CV', href: '/cv/' },
	{ label: 'Contact', href: '/#contact' },
];

export const CONTACT = {
	email: 'chao.wang@unc.edu',
	addressLines: ['104 South Rd., CB #3315', 'Chapel Hill, NC 27599-3315'],
};

export const PROFILES = [
	{ label: 'Google Scholar', href: 'https://scholar.google.com/citations?user=Q0IKlZwAAAAJ&hl=en' },
	{ label: 'GitHub', href: 'https://github.com/ChaoEcohydroRS' },
];

/**
 * The downloadable CV. Put the PDF at public/files/Chao-Wang-CV.pdf and the
 * "Download CV (PDF)" links appear automatically; until then only the CV page is linked.
 */
export const CV_PDF = '/files/Chao-Wang-CV.pdf';

/** How the site owner's name appears in BibTeX author lists (used to set it in bold). */
export const OWNER_SURNAME = 'Wang';
export const OWNER_GIVEN_INITIAL = 'C';
