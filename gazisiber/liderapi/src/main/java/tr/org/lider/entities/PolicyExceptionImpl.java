/*
*
*    Copyright © 2015-2016 Tübitak ULAKBIM
*
*    This file is part of Lider Ahenk.
*
*    Lider Ahenk is free software: you can redistribute it and/or modify
*    it under the terms of the GNU General Public License as published by
*    the Free Software Foundation, either version 3 of the License, or
*    (at your option) any later version.
*
*    Lider Ahenk is distributed in the hope that it will be useful,
*    but WITHOUT ANY WARRANTY; without even the implied warranty of
*    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*    GNU General Public License for more details.
*
*    You should have received a copy of the GNU General Public License
*    along with Lider Ahenk.  If not, see <http://www.gnu.org/licenses/>.
*/
package tr.org.lider.entities;

import java.io.Serializable;
import java.util.Date;
import java.util.List;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.Transient;

import org.hibernate.annotations.CreationTimestamp;

import com.fasterxml.jackson.annotation.JsonFormat;

import tr.org.lider.ldap.DNType;

/**
 * Entity class for Policy Exception objects.
 * 
 */
@Entity
@Table(name = "C_POLICY_EXCEPTION")
public class PolicyExceptionImpl implements Serializable {

	private static final long serialVersionUID = 7634830693350923198L;

	@Id
	@GeneratedValue
	@Column(name = "POLICY_EXCEPTION_ID", unique = true, nullable = false)
	private Long id;

	@Column(name = "LABEL", nullable = false)
	private String label;

	@Column(name = "DESCRIPTION")
	private String description;

	@Column(name = "ACTIVE")
	private boolean active = true;

	@Column(name = "DELETED")
	private boolean deleted = false;
	
	@ManyToOne(fetch = FetchType.EAGER)
	@JoinColumn(name = "policy_id", nullable = false)
	private PolicyImpl policy;

	
	@Temporal(TemporalType.TIMESTAMP)
	@Column(name = "CREATE_DATE", nullable = false, updatable = false)
	@CreationTimestamp
	@JsonFormat(pattern="dd/MM/yyyy HH:mm:ss", timezone="Europe/Istanbul")
	private Date createDate;

	@Temporal(TemporalType.TIMESTAMP)
	@Column(name = "MODIFY_DATE")
	@JsonFormat(pattern="dd/MM/yyyy HH:mm:ss", timezone="Europe/Istanbul")
	private Date modifyDate;

	@Column(name = "DN_TYPE", length = 1)
	private Integer dnType;

	@Column(name = "DN",columnDefinition = "TEXT", length = 1000, nullable = false)
	private String dn;
	
	@Column(name = "GROUP_DN",columnDefinition = "TEXT", length = 1000, nullable = false)
	private String groupDn;
	
	@Transient
	private List<?> members;

	
	public List<?> getMembers() {
		return members;
	}

	public void setMembers(List<?> members) {
		this.members = members;
	}

	public PolicyExceptionImpl() {
	}

	public PolicyExceptionImpl(Long id, String label, String description, boolean active, boolean deleted,
			Date createDate, Date modifyDate, PolicyImpl policy, DNType dnType, String dn) {
		this.id = id;
		this.label = label;
		this.description = description;
		this.active = active;
		this.deleted = deleted;
		this.createDate = createDate;
		this.modifyDate = modifyDate;
		this.policy = policy;
		setDnType(dnType);
		this.dn = dn;
		
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	
	public String getLabel() {
		return label;
	}

	public void setLabel(String label) {
		this.label = label;
	}

	
	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public boolean isActive() {
		return active;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	
	public boolean isDeleted() {
		return deleted;
	}

	public void setDeleted(boolean deleted) {
		this.deleted = deleted;
	}
	
	
	public Date getCreateDate() {
		return createDate;
	}

	public void setCreateDate(Date createDate) {
		this.createDate = createDate;
	}

	
	public Date getModifyDate() {
		return modifyDate;
	}


	public PolicyImpl getPolicy() {
		return policy;
	}

	public void setPolicy(PolicyImpl policy) {
		this.policy = policy;
	}

	public String getDn() {
		return dn;
	}

	public void setDn(String dn) {
		this.dn = dn;
	}
	
	public String getGroupDn() {
		return groupDn;
	}

	public void setGroupDn(String groupDn) {
		this.groupDn = groupDn;
	}

	public void setModifyDate(Date modifyDate) {
		this.modifyDate = modifyDate;
	}
	
	public DNType getDnType() {
		return DNType.getType(dnType);
	}

	public void setDnType(DNType dnType) {
		if (dnType == null) {
			this.dnType = null;
		} else {
			this.dnType = dnType.getId();
		}
	}
	
}
