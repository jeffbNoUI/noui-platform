package employershared

// COPERADivisions is the authoritative list of COPERA's 5 employer divisions.
var COPERADivisions = []Division{
	{DivisionCode: "STATE", DivisionName: "State Division", GoverningStatute: "CRS Title 24, Article 51"},
	{DivisionCode: "SCHOOL", DivisionName: "School Division", GoverningStatute: "CRS Title 24, Article 51"},
	{DivisionCode: "LOCAL_GOV", DivisionName: "Local Government Division", GoverningStatute: "CRS Title 24, Article 51"},
	{DivisionCode: "JUDICIAL", DivisionName: "Judicial Division", GoverningStatute: "CRS Title 24, Article 51"},
	{DivisionCode: "DPS", DivisionName: "Denver Public Schools Division", GoverningStatute: "CRS Title 24, Article 51"},
}

// DivisionByCode returns the Division matching the given code, or nil if not found.
func DivisionByCode(code string) *Division {
	for i := range COPERADivisions {
		if COPERADivisions[i].DivisionCode == code {
			return &COPERADivisions[i]
		}
	}
	return nil
}
